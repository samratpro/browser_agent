import { AgentState, Action, ExecutionGraph, TaskCredentials, TaskIntent, SelectorMap } from '../../shared/types/AgentTypes';

// ─── AgentContext ─────────────────────────────────────────────
// Holds all live runtime state for a single task execution.
// Passed through the entire agent pipeline (Controller → Engine → Recovery).

export interface InterruptSignals {
    shouldStop: boolean;
    shouldPause: boolean;
    shouldResume: boolean;
}

export class AgentContext {
    // Identification
    readonly taskId: string;
    readonly prompt: string;
    readonly credentials: TaskCredentials;

    // Current state
    state: AgentState = AgentState.IDLE;
    intent?: TaskIntent;
    currentUrl: string = '';
    progress: number = 0;

    // Pattern
    patternId?: string;
    selectorMap: SelectorMap = {};
    actions: Action[] = [];

    // Execution tracking
    executionGraph: ExecutionGraph = {
        steps: [],
        currentStepIndex: 0,
        startedAt: Date.now(),
    };

    // Data collection
    extractedData: Record<string, string>[] = [];

    // Screenshot (base64 PNG)
    latestScreenshot: string = '';

    // Error tracking
    errorMessage?: string;
    consecutiveFailures: number = 0;
    maxConsecutiveFailures: number = 3;

    // Interrupt signals (written by controller, read by engine)
    readonly interrupts: InterruptSignals = {
        shouldStop: false,
        shouldPause: false,
        shouldResume: false,
    };

    // Recovery state
    isInRecovery: boolean = false;
    recoveryAttempts: number = 0;
    maxRecoveryAttempts: number = 3;

    constructor(taskId: string, prompt: string, credentials: TaskCredentials = {}) {
        this.taskId = taskId;
        this.prompt = prompt;
        this.credentials = credentials;
    }

    // ─── State helpers ────────────────────────────────────────

    transition(newState: AgentState): void {
        this.state = newState;
    }

    updateProgress(percent: number): void {
        this.progress = Math.min(100, Math.max(0, Math.round(percent)));
    }

    markCurrentStepSuccess(): void {
        const step = this.executionGraph.steps[this.executionGraph.currentStepIndex];
        if (step) {
            step.status = 'success';
            step.finishedAt = Date.now();
            this.consecutiveFailures = 0;
        }
    }

    markCurrentStepFailed(error: string): void {
        const step = this.executionGraph.steps[this.executionGraph.currentStepIndex];
        if (step) {
            step.status = 'failed';
            step.finishedAt = Date.now();
            step.error = error;
            this.consecutiveFailures++;
        }
    }

    advanceStep(): void {
        this.executionGraph.currentStepIndex++;
        const nextStep = this.executionGraph.steps[this.executionGraph.currentStepIndex];
        if (nextStep) {
            nextStep.status = 'running';
            nextStep.startedAt = Date.now();
        }
        this.updateProgress((this.executionGraph.currentStepIndex / Math.max(1, this.executionGraph.steps.length)) * 100);
    }

    buildGraph(actions: Action[]): void {
        this.actions = actions;
        this.executionGraph = {
            steps: actions.map((action, i) => ({
                stepIndex: i,
                action,
                status: i === 0 ? 'running' : 'pending',
                startedAt: i === 0 ? Date.now() : undefined,
            })),
            currentStepIndex: 0,
            startedAt: Date.now(),
        };
    }

    shouldAbort(): boolean {
        return this.interrupts.shouldStop;
    }

    get currentStep() {
        return this.executionGraph.steps[this.executionGraph.currentStepIndex];
    }
}
