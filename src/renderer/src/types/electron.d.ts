import { Task, Pattern, PatternVersion, LogEntry, Schedule } from '../../../shared/types/AgentTypes';

// ─── Dashboard Stats type ─────────────────────────────────────

export interface DashboardStats {
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
    totalPatterns: number;
    patternSuccessRate: number;
    recentActivity: LogEntry[];
}

// ─── Credential types ─────────────────────────────────────────

export interface Credential {
    id: string;
    domain: string;
    label: string;
    username: string;
    createdAt: number;
    updatedAt: number;
}

export interface AddCredentialParams {
    domain: string;
    label: string;
    username: string;
    password: string;
}

// ─── Schedule extended row (joined with pattern) ──────────────

export interface ScheduleRow extends Schedule {
    pattern_name?: string;
    domain?: string;
}

export interface ScheduleRun {
    id: string;
    scheduleId: string;
    taskId: string;
    status: 'success' | 'failed' | 'running';
    startedAt: number;
    finishedAt?: number;
}

// ─── ElectronAPI type surface ─────────────────────────────────

export interface ElectronAPI {
    // Window controls
    windowMinimize: () => void;
    windowMaximize: () => void;
    windowClose: () => void;

    // KV Store
    dbGet: (key: string) => Promise<string | null>;
    dbSet: (key: string, value: string | null) => Promise<void>;

    // External links
    openExternal: (url: string) => Promise<void>;

    // Native dialogs
    openFolderDialog: (defaultPath?: string) => Promise<string | null>;

    // Task control
    runTask: (params: {
        prompt: string;
        url?: string;
        email?: string;
        password?: string;
        twoFactorCode?: string;
        browserConfig?: {
            browserType?: string;
            headless?: boolean;
            profileName?: string;
            profileBaseDir?: string;
            proxy?: { server: string; username?: string; password?: string };
            debugPort?: number;
        };
        resourceFolder?: string;
    }) => Promise<{ taskId: string }>;
    interruptTask: (taskId: string, message: string) => Promise<void>;
    pauseTask: (taskId: string) => Promise<void>;
    resumeTask: (taskId: string) => Promise<void>;
    stopTask: (taskId: string) => Promise<void>;
    deleteTask: (taskId: string) => Promise<void>;
    confirmLearning: (taskId: string) => Promise<void>;
    overrideCaptcha: (taskId: string) => Promise<void>;

    // Task queries
    getTasks: () => Promise<Task[]>;
    getTaskLogs: (taskId: string) => Promise<LogEntry[]>;

    // Dashboard
    getDashboardStats: () => Promise<DashboardStats>;

    // Patterns
    getPatterns: () => Promise<Pattern[]>;
    disablePattern: (id: string, disabled: boolean) => Promise<void>;
    deletePattern: (id: string) => Promise<void>;
    getPatternVersions: (id: string) => Promise<PatternVersion[]>;
    forceRelearn: (id: string) => Promise<void>;

    // Schedules
    getSchedules: () => Promise<ScheduleRow[]>;
    createSchedule: (data: { name: string; patternId: string; cronExpression: string }) => Promise<string>;
    toggleSchedule: (id: string, enabled: boolean) => Promise<void>;
    deleteSchedule: (id: string) => Promise<void>;
    getScheduleRuns: (scheduleId: string) => Promise<ScheduleRun[]>;

    // App Settings (JSON file)
    settingsGetAll: () => Promise<Record<string, string | undefined>>;
    settingsSet: (key: string, value: string | null) => Promise<void>;
    settingsGetProfileBaseDir: () => Promise<string | null>;
    settingsSetProfileBaseDir: (dir: string | null) => Promise<void>;

    // Settings / API Key
    setApiKey: (apiKey: string) => Promise<void>;

    // Credentials
    getCredentials: () => Promise<Credential[]>;
    addCredential: (data: AddCredentialParams) => Promise<string>;
    deleteCredential: (id: string) => Promise<void>;

    // Browser Profile Setup
    setupBrowserProfile: (
        profileName: string,
        url?: string,
        browserType?: string,
        proxy?: { server: string; username?: string; password?: string },
        profileBaseDir?: string
    ) => Promise<{ success: boolean; profilePath: string }>;
    listBrowserProfiles: () => Promise<Array<{ name: string; path: string; createdAt: number }>>;
    deleteBrowserProfile: (profileName: string) => Promise<void>;
    getBrowserProfilesDir: () => Promise<string>;
    getDefaultPaths: () => Promise<{ documents: string; profiles: string; tasks: string }>;

    // ── Push event listeners (clean-up functions returned) ──────

    onTaskUpdate: (cb: (e: { taskId: string; task: Task }) => void) => () => void;

    onTaskLogLine: (cb: (e: { taskId: string; entry: LogEntry }) => void) => () => void;

    onTaskScreenshot: (cb: (e: { taskId: string; base64: string }) => void) => () => void;

    onCaptchaDetected: (cb: (e: {
        taskId: string;
        screenshotBase64: string;
        message: string;
    }) => void) => () => void;

    onLearningComplete: (cb: (e: {
        taskId: string;
        data: { actions: unknown[]; reasoning?: string };
    }) => void) => () => void;
}

// ─── Global window augmentation ───────────────────────────────

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
