import { Browser, BrowserContext, Page } from 'playwright';
import { BrowserManager } from 'ts_playwright_browser_manager';
import EventEmitter from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
    Action,
    AgentState,
    BrowserConfig,
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

import { DatabaseService } from '../db/DatabaseService';

// ─── ExecutionEngine ──────────────────────────────────────────

export class ExecutionEngine extends EventEmitter {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private manager: BrowserManager | null = null;
    private screenshotInterval: NodeJS.Timeout | null = null;
    private currentTaskId: string | null = null;
    private tempProfilePath: string | null = null;

    constructor(private recovery: SelectorRecovery, private db: DatabaseService) {
        super();
    }

    // ─── Lifecycle ─────────────────────────────────────────────

    async launch(config?: BrowserConfig): Promise<void> {
        const headless = config?.headless ?? false;
        const debugPort = config?.debugPort ?? this.db.getNextDebugPort();
        const proxy = config?.proxy;
        const browserType = config?.browserType ?? 'chromium';
        const profileName = config?.profileName || `task_${Date.now()}`;

        // Initialize Browser Manager
        this.manager = new BrowserManager({
            debugPort,
            browserPath: this.findBrowserPath(browserType) || undefined,
            baseProfileDir: config?.profilePath ? path.dirname(config.profilePath) : path.join(os.tmpdir(), 'ai-browser-agent-profiles')
        });

        this.log('info', `Launching ${browserType} via BrowserManager...`);

        try {
            const conn = proxy?.server 
                ? await this.manager.connectToBrowserWithProxy({
                    profileName,
                    proxy: {
                        server: proxy.server,
                        username: proxy.username,
                        password: proxy.password
                    },
                    headless
                })
                : await this.manager.connectToBrowser(profileName, undefined, headless);

            this.browser = conn.browser;
            this.context = conn.context;
            this.page = conn.page;

            // Apply basic anti-detection to every page
            await conn.context.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            });

            this.log('info', `Browser ready: ${browserType}${headless ? ' (headless)' : ''}`);
        } catch (err) {
            this.log('error', `Failed to launch browser: ${err instanceof Error ? err.message : String(err)}`);
            throw err;
        }
    }

    async close(): Promise<void> {
        this.stopScreenshotCapture();

        if (this.manager) {
            try {
                await this.manager.closeBrowser();
                await this.manager.dispose();
            } catch (err) {
                this.log('warn', `Error during browser close: ${err}`);
            }
        }

        this.browser = null;
        this.context = null;
        this.page = null;
        this.manager = null;
        this.tempProfilePath = null;
        this.log('info', 'Browser sessions cleaned up');
    }



    // ─── Browser path resolution (mirrors ts_playwright_browser_manager) ──

    private findBrowserPath(browserType: string): string | null {
        const platform = os.platform();
        const home = os.homedir();

        const pathMap: Record<string, string[]> = {
            chrome: platform === 'win32' ? [
                path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            ] : platform === 'darwin' ? [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            ] : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'],

            edge: platform === 'win32' ? [
                path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            ] : platform === 'darwin' ? [
                '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            ] : ['/usr/bin/microsoft-edge'],

            brave: platform === 'win32' ? [
                path.join(home, 'AppData', 'Local', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
                'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
                'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
            ] : platform === 'darwin' ? [
                '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
            ] : ['/usr/bin/brave-browser'],

            comet: platform === 'win32' ? [
                path.join(home, 'AppData', 'Local', 'CometBrowser', 'Application', 'comet.exe'),
                'C:\\Program Files\\CometBrowser\\Application\\comet.exe',
            ] : platform === 'darwin' ? [
                '/Applications/Comet Browser.app/Contents/MacOS/Comet Browser',
            ] : ['/usr/bin/comet'],

            chromium: platform === 'win32' ? [
                path.join(home, 'AppData', 'Local', 'Chromium', 'Application', 'chromium.exe'),
                'C:\\Program Files\\Chromium\\Application\\chromium.exe',
            ] : platform === 'darwin' ? [
                '/Applications/Chromium.app/Contents/MacOS/Chromium',
            ] : ['/usr/bin/chromium-browser', '/usr/bin/chromium'],
        };

        const candidates = pathMap[browserType] ?? [];
        return candidates.find((p) => fs.existsSync(p)) ?? null;
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

            this.log('info', `Step ${i + 1}/${ctx.executionGraph.steps.length}: ${step.action.type}`);

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
            (failedAction as Record<string, unknown>).selector = result.newSelector;

            if (failedSelector in ctx.selectorMap) {
                ctx.selectorMap[failedSelector] = {
                    ...ctx.selectorMap[failedSelector],
                    selector: result.newSelector,
                    lastVerifiedAt: Date.now(),
                };
            }

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