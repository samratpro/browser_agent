import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
    AgentState,
    Task,
    TaskCredentials,
    TaskIntent,
    LogLevel,
    LogEntry,
    ExecutionGraph,
} from '../../shared/types/AgentTypes';
import { AgentContext } from './AgentContext';
import { ExecutionEngine } from './ExecutionEngine';
import { AIPlanner } from './AIPlanner';
import { SelectorRecovery } from './SelectorRecovery';
import { PatternRepository } from '../db/PatternRepository';
import { DatabaseService } from '../db/DatabaseService';
import { CredentialService } from '../db/CredentialService';
import { compressHTML, extractInteractiveElements } from './DOMCompressor';

// ─── AgentController ──────────────────────────────────────────
// Orchestrates the full task lifecycle:
//   IDLE → PLANNING → EXPLORING → LEARNING → EXECUTING → COMPLETED/FAILED
// Handles all state machine transitions, interrupt signals,
// exploration/learning modes, and persistence.

export class AgentController extends EventEmitter {
    private contexts: Map<string, AgentContext> = new Map();
    private engines: Map<string, ExecutionEngine> = new Map();

    private credentialService: CredentialService;
    private aiPlanner: AIPlanner;
    private patternRepo: PatternRepository;
    private db: DatabaseService;

    constructor(deps?: {
        db?: DatabaseService;
        credentialService?: CredentialService;
        patternRepo?: PatternRepository;
    }) {
        super();
        this.db = deps?.db ?? new DatabaseService();
        this.credentialService = deps?.credentialService ?? new CredentialService();
        this.aiPlanner = new AIPlanner(this.credentialService);
        this.patternRepo = deps?.patternRepo ?? new PatternRepository(this.db);
    }

    // ─── Create & Run Task ────────────────────────────────────

    async runTask(
        taskId: string,
        prompt: string,
        targetUrl: string,
        credentials: TaskCredentials = {},
    ): Promise<void> {
        const ctx = new AgentContext(taskId, prompt, credentials);
        this.contexts.set(taskId, ctx);

        const engine = new ExecutionEngine(new SelectorRecovery(this.aiPlanner));
        this.engines.set(taskId, engine);

        // Wire engine events → controller events
        engine.on('stateChange', (state: AgentState) => {
            ctx.transition(state);
            this.emitStateChange(ctx);
            this.persistTaskState(ctx);
        });

        engine.on('screenshot', (tid: string, base64: string) => {
            ctx.latestScreenshot = base64;
            this.emit('screenshot', tid, base64);
        });

        engine.on('logLine', (_tid: unknown, level: LogLevel, message: string) => {
            this.appendLog(taskId, level, message);
        });

        engine.on('captcha', (tid: string, screenshotBase64: string) => {
            ctx.transition(AgentState.WAITING_USER);
            this.emitStateChange(ctx);
            this.persistTaskState(ctx);
            this.emit('captcha', tid, screenshotBase64, 'CAPTCHA detected. Please solve manually.');
        });

        try {
            // PLANNING
            ctx.transition(AgentState.PLANNING);
            this.emitStateChange(ctx);
            this.appendLog(taskId, 'info', 'Classifying intent...');

            const intent = await this.aiPlanner.classifyIntent(prompt);
            ctx.intent = intent;
            this.appendLog(taskId, 'info', `Intent classified: ${intent}`);

            // Check for existing pattern
            let domain = '';
            try { domain = new URL(targetUrl).hostname; } catch { domain = targetUrl; }

            const existingPattern = this.patternRepo.getByDomainAndIntent(domain, intent);

            if (existingPattern) {
                // DETERMINISTIC FAST mode — use existing pattern
                this.appendLog(taskId, 'info', `Found existing pattern: ${existingPattern.name}. Running in deterministic mode.`);
                ctx.patternId = existingPattern.id;
                ctx.selectorMap = existingPattern.selectorMap;
                ctx.buildGraph(existingPattern.actions);

                await engine.launch();
                ctx.transition(AgentState.EXECUTING);
                this.emitStateChange(ctx);
                this.persistTaskState(ctx);

                await engine.executeActions(ctx);

                if (!ctx.shouldAbort()) {
                    ctx.transition(AgentState.COMPLETED);
                    ctx.updateProgress(100);
                    this.patternRepo.recordSuccess(existingPattern.id);
                }
            } else {
                // EXPLORATION mode — AI-assisted
                ctx.transition(AgentState.EXPLORING);
                this.emitStateChange(ctx);
                this.appendLog(taskId, 'info', 'No pattern found. Entering exploration mode...');

                await engine.launch();

                // Navigate to target URL first
                ctx.buildGraph([{ type: 'navigate', url: targetUrl }]);
                await engine.executeActions(ctx);
                ctx.executionGraph.steps = [];
                ctx.executionGraph.currentStepIndex = 0;

                // Get DOM and compress
                const html = await engine.getPageHTML();
                const interactive = extractInteractiveElements(html);
                const compressedDOM = compressHTML(html);
                ctx.currentUrl = await engine.getCurrentUrl();

                // AI: generate exploration plan
                const exploration = await this.aiPlanner.planExploration(
                    prompt,
                    ctx.currentUrl,
                    compressedDOM,
                    5,
                );
                this.appendLog(taskId, 'info', `Exploration plan generated: ${exploration.actions.length} actions`);

                if (exploration.selectorSuggestions) {
                    for (const s of exploration.selectorSuggestions) {
                        ctx.selectorMap[s.field] = s;
                    }
                }

                // Execute exploration actions
                ctx.transition(AgentState.LEARNING);
                this.emitStateChange(ctx);
                ctx.buildGraph(exploration.actions);
                await engine.executeActions(ctx);

                // Plan full actions from learned state
                const fullPlan = await this.aiPlanner.planActions({
                    prompt,
                    intent,
                    currentUrl: ctx.currentUrl,
                    compressedDOM: compressHTML(await engine.getPageHTML()),
                });

                this.appendLog(taskId, 'info', `Full action plan: ${fullPlan.actions.length} steps`);

                // Signal UI for preview + confirmation
                ctx.transition(AgentState.WAITING_USER);
                this.emitStateChange(ctx);
                this.persistTaskState(ctx);

                this.emit('learningComplete', taskId, {
                    selectorMap: ctx.selectorMap,
                    actions: fullPlan.actions,
                    reasoning: fullPlan.reasoning,
                });

                // Wait for user confirmation (interrupt resume signal)
                await this.waitForResume(ctx);
                if (ctx.shouldAbort()) {
                    ctx.transition(AgentState.FAILED);
                    ctx.errorMessage = 'User aborted during learning confirmation.';
                    this.emitStateChange(ctx);
                    this.persistTaskState(ctx);
                    await engine.close();
                    return;
                }

                // Save new pattern
                const newPattern = this.patternRepo.create(
                    domain,
                    intent,
                    `${intent} @ ${domain}`,
                    ctx.selectorMap,
                    fullPlan.actions,
                    prompt,
                );
                ctx.patternId = newPattern.id;
                this.appendLog(taskId, 'info', `Pattern saved: ${newPattern.id}`);

                // Now EXECUTE deterministically
                ctx.buildGraph(fullPlan.actions);
                ctx.transition(AgentState.EXECUTING);
                this.emitStateChange(ctx);

                await engine.executeActions(ctx);

                if (!ctx.shouldAbort()) {
                    ctx.transition(AgentState.COMPLETED);
                    ctx.updateProgress(100);
                    this.patternRepo.recordSuccess(newPattern.id);
                }
            }

            if (!ctx.shouldAbort()) {
                this.appendLog(taskId, 'info', 'Task completed successfully');
            }
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            ctx.errorMessage = error;
            ctx.transition(ctx.interrupts.shouldStop ? AgentState.FAILED : AgentState.FAILED);
            this.appendLog(taskId, 'error', `Task failed: ${error}`);

            if (ctx.patternId) {
                this.patternRepo.recordFailure(ctx.patternId);
            }
        } finally {
            this.emitStateChange(ctx);
            this.persistTaskState(ctx);
            await this.engines.get(taskId)?.close();
            this.engines.delete(taskId);
        }
    }

    // ─── Interrupt Controls ───────────────────────────────────

    pauseTask(taskId: string): boolean {
        const ctx = this.contexts.get(taskId);
        if (!ctx || ctx.state !== AgentState.EXECUTING) return false;
        ctx.interrupts.shouldPause = true;
        ctx.interrupts.shouldResume = false;
        ctx.transition(AgentState.PAUSED);
        this.emitStateChange(ctx);
        this.persistTaskState(ctx);
        this.appendLog(taskId, 'info', 'Task paused by user');
        return true;
    }

    resumeTask(taskId: string): boolean {
        const ctx = this.contexts.get(taskId);
        if (!ctx) return false;
        ctx.interrupts.shouldPause = false;
        ctx.interrupts.shouldResume = true;
        if (ctx.state === AgentState.PAUSED || ctx.state === AgentState.WAITING_USER) {
            ctx.transition(AgentState.EXECUTING);
            this.emitStateChange(ctx);
            this.persistTaskState(ctx);
        }
        this.appendLog(taskId, 'info', 'Task resumed by user');
        return true;
    }

    stopTask(taskId: string): boolean {
        const ctx = this.contexts.get(taskId);
        if (!ctx) return false;
        ctx.interrupts.shouldStop = true;
        ctx.interrupts.shouldPause = false;
        ctx.transition(AgentState.FAILED);
        ctx.errorMessage = 'Stopped by user.';
        this.emitStateChange(ctx);
        this.persistTaskState(ctx);
        this.appendLog(taskId, 'warn', 'Task stopped by user');
        return true;
    }

    confirmLearning(taskId: string): void {
        this.resumeTask(taskId);
    }

    overrideCaptcha(taskId: string): void {
        this.resumeTask(taskId);
    }

    // ─── Wait helper ──────────────────────────────────────────

    private async waitForResume(ctx: AgentContext): Promise<void> {
        while (
            !ctx.interrupts.shouldResume &&
            !ctx.interrupts.shouldStop
        ) {
            await sleep(400);
        }
        ctx.interrupts.shouldResume = false;
    }

    // ─── Persistence ──────────────────────────────────────────

    private persistTaskState(ctx: AgentContext): void {
        const now = Date.now();
        this.db.run(
            `UPDATE tasks SET
        state = ?,
        progress = ?,
        execution_graph = ?,
        extracted_data = ?,
        error_message = ?,
        pattern_id = ?,
        started_at = COALESCE(started_at, ?),
        completed_at = ?,
        updated_at = ?
       WHERE id = ?`,
            [
                ctx.state,
                ctx.progress,
                JSON.stringify(ctx.executionGraph),
                JSON.stringify(ctx.extractedData),
                ctx.errorMessage ?? null,
                ctx.patternId ?? null,
                now,
                ctx.state === AgentState.COMPLETED || ctx.state === AgentState.FAILED ? now : null,
                now,
                ctx.taskId,
            ],
        );
    }

    private appendLog(taskId: string, level: LogLevel, message: string, context?: Record<string, unknown>): void {
        const entry: LogEntry = {
            id: uuidv4(),
            taskId,
            level,
            message,
            context,
            timestamp: Date.now(),
        };
        this.db.run(
            'INSERT INTO logs (id,task_id,level,message,context,timestamp) VALUES (?,?,?,?,?,?)',
            [entry.id, taskId, level, message, context ? JSON.stringify(context) : null, entry.timestamp],
        );
        this.emit('logLine', taskId, entry);
    }

    private emitStateChange(ctx: AgentContext): void {
        this.emit('taskUpdate', {
            taskId: ctx.taskId,
            state: ctx.state,
            progress: ctx.progress,
            currentStep: ctx.currentStep?.action.type,
            errorMessage: ctx.errorMessage,
        });
    }

    // ─── Task Queries ─────────────────────────────────────────

    createTaskRecord(
        prompt: string,
        domain: string,
        credentials: TaskCredentials,
    ): string {
        const id = uuidv4();
        const now = Date.now();
        const name = prompt.slice(0, 60) + (prompt.length > 60 ? '...' : '');

        this.db.run(
            `INSERT INTO tasks (id,name,domain,prompt,state,progress,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
            [id, name, domain, prompt, AgentState.IDLE, 0, now, now],
        );
        return id;
    }

    getContext(taskId: string): AgentContext | undefined {
        return this.contexts.get(taskId);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
