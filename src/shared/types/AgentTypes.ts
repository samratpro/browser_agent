// ============================================================
// Shared Type Definitions for AI Browser Automation System
// ============================================================

// ─── Agent State Machine ────────────────────────────────────

export enum AgentState {
    IDLE = 'IDLE',
    PLANNING = 'PLANNING',
    EXPLORING = 'EXPLORING',
    LEARNING = 'LEARNING',
    EXECUTING = 'EXECUTING',
    STUCK = 'STUCK',
    WAITING_USER = 'WAITING_USER',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    REPAIRING = 'REPAIRING',
}

// ─── Intent Classification ───────────────────────────────────

export type TaskIntent =
    | 'scrape'
    | 'test'
    | 'login'
    | 'monitor'
    | 'automate';

// ─── Action Types (Discriminated Unions) ─────────────────────

export type Action =
    | { type: 'navigate'; url: string }
    | { type: 'click'; selector: string }
    | { type: 'type'; selector: string; value: string }
    | { type: 'extract'; selector: string; field: string }
    | { type: 'loop'; selector: string; actions: Action[] }
    | { type: 'assert'; selector: string; expected: string }
    | { type: 'wait'; ms: number }
    | { type: 'screenshot' }
    | { type: 'scroll'; selector?: string; direction: 'up' | 'down' };

// ─── Execution Graph ─────────────────────────────────────────

export interface ExecutionStep {
    stepIndex: number;
    action: Action;
    status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
    startedAt?: number;
    finishedAt?: number;
    error?: string;
    extractedData?: Record<string, string>;
}

export interface ExecutionGraph {
    steps: ExecutionStep[];
    currentStepIndex: number;
    startedAt: number;
    finishedAt?: number;
}

// ─── Selector Map ────────────────────────────────────────────

export interface SelectorEntry {
    field: string;
    selector: string;
    selectorType: 'css' | 'xpath' | 'text' | 'aria';
    confidence: number;
    lastVerifiedAt: number;
    fingerprint?: string;
}

export type SelectorMap = Record<string, SelectorEntry>;

// ─── Patterns ────────────────────────────────────────────────

export interface Pattern {
    id: string;
    domain: string;
    intent: TaskIntent;
    name: string;
    description?: string;
    selectorMap: SelectorMap;
    actions: Action[];
    successCount: number;
    failureCount: number;
    successRate: number;
    isDisabled: boolean;
    currentVersion: number;
    createdAt: number;
    updatedAt: number;
}

export interface PatternVersion {
    id: string;
    patternId: string;
    version: number;
    selectorMap: SelectorMap;
    actions: Action[];
    changeNote?: string;
    createdAt: number;
}

// ─── Task ────────────────────────────────────────────────────

export interface TaskCredentials {
    url?: string;
    email?: string;
    password?: string;
    twoFactorCode?: string;
}

export interface Task {
    id: string;
    name: string;
    domain: string;
    prompt: string;
    intent?: TaskIntent;
    credentials?: TaskCredentials;
    state: AgentState;
    progress: number; // 0–100
    patternId?: string;
    executionGraph?: ExecutionGraph;
    extractedData?: Record<string, any>[]; // Replaces results in plan
    pageType?: 'home' | 'list' | 'detail' | 'external' | 'form';
    strategy?: 'exact' | 'fuzzy' | 'text' | 'regex' | 'auto';
    currentSelector?: string;
    confidence?: number;
    learnedPattern?: any;
    targetUrl?: string; // Explicitly for display
    trained?: boolean;
    errorMessage?: string;
    scheduleId?: string;
    startedAt?: number;
    completedAt?: number;
    createdAt: number;
    updatedAt: number;
}

// ─── Log ─────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    id: string;
    taskId: string;
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    timestamp: number;
}

// ─── Schedule ────────────────────────────────────────────────

export interface Schedule {
    id: string;
    name: string;
    patternId: string;
    cronExpression: string;
    isEnabled: boolean;
    lastRunAt?: number;
    nextRunAt?: number;
    createdAt: number;
    updatedAt: number;
}

export interface ScheduleRun {
    id: string;
    scheduleId: string;
    taskId: string;
    status: 'success' | 'failed' | 'running';
    startedAt: number;
    finishedAt?: number;
}

// ─── Credentials (Stored) ────────────────────────────────────

export interface StoredCredential {
    id: string;
    domain: string;
    label: string;
    username: string;
    // password stored encrypted in OS keychain keyed by this id
    createdAt: number;
    updatedAt: number;
}

// ─── IPC Events ──────────────────────────────────────────────

export interface TaskUpdateEvent {
    taskId: string;
    state: AgentState;
    progress: number;
    currentStep?: string;
    errorMessage?: string;
}

export interface LogLineEvent {
    taskId: string;
    entry: LogEntry;
}

export interface ScreenshotEvent {
    taskId: string;
    base64: string;
    timestamp: number;
}

export interface CaptchaEvent {
    taskId: string;
    screenshotBase64?: string;
    message: string;
}

// ─── AI Planner Types ────────────────────────────────────────

export interface PlannerRequest {
    prompt: string;
    intent: TaskIntent;
    compressedDOM?: string;
    currentUrl: string;
    errorContext?: string;
    availableSelectors?: string[];
}

export interface PlannerResponse {
    actions: Action[];
    reasoning?: string;
    selectorSuggestions?: SelectorEntry[];
}

// ─── Recovery ────────────────────────────────────────────────

export interface RecoveryContext {
    failedSelector: string;
    failedAction: Action;
    compressedDOM: string;
    currentUrl: string;
    stepIndex: number;
}

export interface RecoveryResult {
    recovered: boolean;
    newSelector?: string;
    fallbackAction?: Action;
    strategy: 'fuzzy' | 'text' | 'fingerprint' | 'ai' | 'none';
}


// ─── Browser Config ──────────────────────────────────────────

export type BrowserLaunchType = 'chrome' | 'edge' | 'brave' | 'chromium' | 'comet';

export interface BrowserConfig {
    browserType?: BrowserLaunchType;
    headless?: boolean;
    profileName?: string;
    profilePath?: string; // resolved absolute path, set by ipcHandlers via BrowserProfileService
    resourceFolder?: string; // folder for input/output files
    proxy?: {
        server: string;
        username?: string;
        password?: string;
    };
    debugPort?: number;
}

// ─── Dashboard Stats ─────────────────────────────────────────

export interface DashboardStats {
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
    totalPatterns: number;
    patternSuccessRate: number;
    recentActivity: LogEntry[];
}
