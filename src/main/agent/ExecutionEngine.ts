import { Browser, BrowserContext, Page, chromium } from 'playwright';
import EventEmitter from 'events';
import {
    Action,
    AgentState,
    ExecutionStep,
    LogLevel,
} from '../../shared/types/AgentTypes';
import { AgentContext } from './AgentContext';
import { SelectorRecovery } from './SelectorRecovery';
import { compressHTML } from './DOMCompressor';

const STEP_TIMEOUT_MS = 15_000;
const NAVIGATE_TIMEOUT_MS = 30_000;
const SCREENSHOT_INTERVAL_MS = 2_000;

// ─── Events emitted by ExecutionEngine ───────────────────────
export interface EngineEvents {
    stateChange: [state: AgentState, taskId: string];
    screenshot: [taskId: string, base64: string];
    logLine: [taskId: string, level: LogLevel, message: string];
    stepComplete: [taskId: string, step: ExecutionStep];
    captcha: [taskId: string, screenshotBase64: string];
}

// ─── ExecutionEngine ──────────────────────────────────────────

export class ExecutionEngine extends EventEmitter {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private screenshotInterval: NodeJS.Timeout | null = null;
    private currentTaskId: string | null = null;

    constructor(private recovery: SelectorRecovery) {
        super();
    }

    // ─── Lifecycle ─────────────────────────────────────────────

    async launch(): Promise<void> {
        this.browser = await chromium.launch({
            headless: false, // visible for user oversight
            args: ['--disable-blink-features=AutomationControlled'],
        });
        this.context = await this.browser.newContext({
            userAgent:
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 },
        });
        this.page = await this.context.newPage();
        this.log('info', 'Browser launched');
    }

    async close(): Promise<void> {
        this.stopScreenshotCapture();
        try {
            await this.context?.close();
            await this.browser?.close();
        } catch {
            // ignore cleanup errors
        }
        this.browser = null;
        this.context = null;
        this.page = null;
        this.log('info', 'Browser closed');
    }

    // ─── Screenshot streaming ──────────────────────────────────

    startScreenshotCapture(taskId: string): void {
        this.screenshotInterval = setInterval(async () => {
            if (!this.page) return;
            try {
                const buf = await this.page.screenshot({ type: 'jpeg', quality: 60 });
                this.emit('screenshot', taskId, buf.toString('base64'));
            } catch {
                // page may be navigating
            }
        }, SCREENSHOT_INTERVAL_MS);
    }

    stopScreenshotCapture(): void {
        if (this.screenshotInterval) {
            clearInterval(this.screenshotInterval);
            this.screenshotInterval = null;
        }
    }

    // ─── Execute action list ───────────────────────────────────

    async executeActions(ctx: AgentContext): Promise<void> {
        if (!this.page) throw new Error('Browser not launched');
        this.currentTaskId = ctx.taskId;

        this.startScreenshotCapture(ctx.taskId);

        for (let i = ctx.executionGraph.currentStepIndex; i < ctx.executionGraph.steps.length; i++) {
            // Check interrupt signals
            if (ctx.shouldAbort()) {
                this.log('info', 'Task aborted by user');
                break;
            }

            while (ctx.interrupts.shouldPause && !ctx.interrupts.shouldStop) {
                this.log('info', 'Task paused — waiting...');
                await sleep(500);
            }

            if (ctx.shouldAbort()) break;

            const step = ctx.executionGraph.steps[i];
            ctx.executionGraph.currentStepIndex = i;
            step.status = 'running';
            step.startedAt = Date.now();

            this.log('info', `Executing step ${i + 1}/${ctx.executionGraph.steps.length}: ${step.action.type}`);

            try {
                await this.executeStep(ctx, step.action);
                step.status = 'success';
                step.finishedAt = Date.now();
                ctx.consecutiveFailures = 0;
                ctx.updateProgress(((i + 1) / ctx.executionGraph.steps.length) * 100);
                this.emit('stepComplete', ctx.taskId, step);
            } catch (err) {
                const error = err instanceof Error ? err.message : String(err);
                step.error = error;
                this.log('warn', `Step ${i + 1} failed: ${error} — attempting recovery`);

                const recovered = await this.attemptRecovery(ctx, step.action, error);
                if (recovered) {
                    // Re-execute with recovered selector
                    step.status = 'success';
                    step.finishedAt = Date.now();
                    ctx.consecutiveFailures = 0;
                } else {
                    step.status = 'failed';
                    step.finishedAt = Date.now();
                    ctx.consecutiveFailures++;
                    this.log('error', `Step ${i + 1} unrecoverable: ${error}`);

                    if (ctx.consecutiveFailures >= ctx.maxConsecutiveFailures) {
                        throw new Error(`Too many consecutive failures. Last: ${error}`);
                    }
                }
            }

            // Small delay between steps
            await sleep(300);
        }

        this.stopScreenshotCapture();
    }

    // ─── Execute single action ─────────────────────────────────

    private async executeStep(ctx: AgentContext, action: Action): Promise<void> {
        const page = this.page!;

        switch (action.type) {
            case 'navigate':
                await page.goto(action.url, { timeout: NAVIGATE_TIMEOUT_MS, waitUntil: 'domcontentloaded' });
                ctx.currentUrl = page.url();
                this.log('info', `Navigated to: ${action.url}`);
                break;

            case 'click':
                await page.waitForSelector(action.selector, { timeout: STEP_TIMEOUT_MS, state: 'visible' });
                await page.click(action.selector);
                this.log('info', `Clicked: ${action.selector}`);
                break;

            case 'type':
                await page.waitForSelector(action.selector, { timeout: STEP_TIMEOUT_MS, state: 'visible' });
                await page.fill(action.selector, action.value);
                this.log('info', `Typed into: ${action.selector}`);
                break;

            case 'extract': {
                const elements = await page.$$(action.selector);
                const values = await Promise.all(
                    elements.map((el) => el.textContent().then((t) => t?.trim() ?? '')),
                );
                ctx.extractedData.push({ [action.field]: values.join('\n') });
                this.log('info', `Extracted ${elements.length} items for field: ${action.field}`);
                break;
            }

            case 'loop': {
                const items = await page.$$(action.selector);
                this.log('info', `Loop: found ${items.length} items`);
                for (let i = 0; i < items.length; i++) {
                    if (ctx.shouldAbort()) break;
                    // For loop actions, execute each sub-action
                    for (const subAction of action.actions) {
                        await this.executeStep(ctx, subAction);
                    }
                }
                break;
            }

            case 'assert': {
                const el = await page.$(action.selector);
                if (!el) throw new Error(`Assert failed: element not found (${action.selector})`);
                const text = await el.textContent();
                if (!text?.includes(action.expected)) {
                    throw new Error(`Assert failed: expected "${action.expected}" in "${text?.slice(0, 80)}"`);
                }
                this.log('info', `Assert passed: ${action.selector}`);
                break;
            }

            case 'wait':
                await sleep(action.ms);
                break;

            case 'screenshot': {
                const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
                ctx.latestScreenshot = buf.toString('base64');
                this.emit('screenshot', ctx.taskId, ctx.latestScreenshot);
                break;
            }

            case 'scroll':
                if (action.selector) {
                    await page.locator(action.selector).scrollIntoViewIfNeeded();
                } else {
                    await page.evaluate(
                        (dir) => window.scrollBy(0, dir === 'down' ? 600 : -600),
                        action.direction,
                    );
                }
                break;
        }
    }

    // ─── Recovery ──────────────────────────────────────────────

    private async attemptRecovery(
        ctx: AgentContext,
        failedAction: Action,
        error: string,
    ): Promise<boolean> {
        if (!this.page) return false;

        const failedSelector = 'selector' in failedAction ? (failedAction as { selector: string }).selector : '';
        if (!failedSelector) return false;

        const html = await this.page.content().catch(() => '');
        const knownSelectors = Object.values(ctx.selectorMap);

        const result = await this.recovery.recover(this.page, {
            failedSelector,
            failedAction,
            compressedDOM: compressHTML(html),
            currentUrl: ctx.currentUrl,
            stepIndex: ctx.executionGraph.currentStepIndex,
        }, knownSelectors);

        if (result.recovered && result.newSelector) {
            this.log('info', `Recovery via ${result.strategy}: ${result.newSelector}`);
            // Patch the action in-place
            (failedAction as Record<string, unknown>).selector = result.newSelector;

            // Update the selector map
            if (failedSelector in ctx.selectorMap) {
                ctx.selectorMap[failedSelector] = {
                    ...ctx.selectorMap[failedSelector],
                    selector: result.newSelector,
                    lastVerifiedAt: Date.now(),
                };
            }

            // Re-execute with new selector
            await this.executeStep(ctx, failedAction);
            return true;
        }

        return false;
    }

    // ─── CAPTCHA detection ─────────────────────────────────────

    async detectCaptcha(taskId: string): Promise<boolean> {
        if (!this.page) return false;
        try {
            const url = this.page.url();
            const title = await this.page.title();
            const isCaptcha =
                url.includes('captcha') ||
                url.includes('recaptcha') ||
                title.toLowerCase().includes('captcha') ||
                (await this.page.$('[class*="captcha"], [id*="captcha"], .g-recaptcha').then((el) => !!el));

            if (isCaptcha) {
                const buf = await this.page.screenshot({ type: 'jpeg', quality: 70 });
                this.emit('captcha', taskId, buf.toString('base64'));
                this.log('warn', 'CAPTCHA detected — waiting for user');
            }
            return isCaptcha;
        } catch {
            return false;
        }
    }

    // ─── Page Info ────────────────────────────────────────────

    async getPageHTML(): Promise<string> {
        return this.page?.content() ?? '';
    }

    async getCurrentUrl(): Promise<string> {
        return this.page?.url() ?? '';
    }

    // ─── Logging ──────────────────────────────────────────────

    private log(level: LogLevel, message: string): void {
        this.emit('logLine', this.currentTaskId, level, message);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
