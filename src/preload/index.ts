import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';

// ─── Type-safe API surface exposed to renderer ───────────────

const customAPI = {
    // ── Window Controls ────────────────────────────────────────
    windowMinimize: () => ipcRenderer.send('window:minimize'),
    windowMaximize: () => ipcRenderer.send('window:maximize'),
    windowClose: () => ipcRenderer.send('window:close'),
    windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),

    // ── App KV Store (for auth user, settings, etc.) ──────────
    dbGet: (key: string) => ipcRenderer.invoke('db:get', key),
    dbSet: (key: string, value: string | null) => ipcRenderer.invoke('db:set', key, value),

    // ── External Links ─────────────────────────────────────────
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

    // ── Native Dialogs ─────────────────────────────────────────
    openFolderDialog: (defaultPath?: string) =>
        ipcRenderer.invoke('dialog:openFolder', defaultPath),

    // ── Task Control ───────────────────────────────────────────
    runTask: (params: {
        prompt: string;
        url: string;
        email?: string;
        password?: string;
        twoFactorCode?: string;
        browserConfig?: {
            browserType?: string;
            headless?: boolean;
            profileName?: string;
            proxy?: { server: string; username?: string; password?: string };
            debugPort?: number;
        };
        resourceFolder?: string;
    }) => ipcRenderer.invoke('task:run', params),

    interruptTask: (taskId: string, message: string) =>
        ipcRenderer.invoke('task:interrupt', taskId, message),

    pauseTask: (taskId: string) => ipcRenderer.invoke('task:pause', taskId),
    resumeTask: (taskId: string) => ipcRenderer.invoke('task:resume', taskId),
    stopTask: (taskId: string) => ipcRenderer.invoke('task:stop', taskId),
    deleteTask: (taskId: string) => ipcRenderer.invoke('task:delete', taskId),
    confirmLearning: (taskId: string) => ipcRenderer.invoke('task:confirmLearning', taskId),
    overrideCaptcha: (taskId: string) => ipcRenderer.invoke('task:overrideCaptcha', taskId),

    // ── Task Queries ───────────────────────────────────────────
    getTasks: () => ipcRenderer.invoke('task:getAll'),
    getTaskLogs: (taskId: string) => ipcRenderer.invoke('task:getLogs', taskId),
    getDashboardStats: () => ipcRenderer.invoke('dashboard:getStats'),

    // ── Patterns ───────────────────────────────────────────────
    getPatterns: () => ipcRenderer.invoke('pattern:getAll'),
    disablePattern: (id: string, disabled: boolean) => ipcRenderer.invoke('pattern:setDisabled', id, disabled),
    deletePattern: (id: string) => ipcRenderer.invoke('pattern:delete', id),
    getPatternVersions: (id: string) => ipcRenderer.invoke('pattern:getVersions', id),
    forceRelearn: (id: string) => ipcRenderer.invoke('pattern:forceRelearn', id),

    // ── Schedules ──────────────────────────────────────────────
    getSchedules: () => ipcRenderer.invoke('schedule:getAll'),
    createSchedule: (data: {
        name: string;
        patternId: string;
        cronExpression: string;
    }) => ipcRenderer.invoke('schedule:create', data),
    toggleSchedule: (id: string, enabled: boolean) => ipcRenderer.invoke('schedule:toggle', id, enabled),
    deleteSchedule: (id: string) => ipcRenderer.invoke('schedule:delete', id),
    getScheduleRuns: (scheduleId: string) => ipcRenderer.invoke('schedule:getRuns', scheduleId),

    // ── App Settings (JSON file) ───────────────────────────────
    settingsGetAll: () => ipcRenderer.invoke('settings:getAll'),
    settingsSet: (key: string, value: string | null) =>
        ipcRenderer.invoke('settings:set', key, value),
    settingsGetProfileBaseDir: () => ipcRenderer.invoke('settings:getProfileBaseDir'),
    settingsSetProfileBaseDir: (dir: string | null) =>
        ipcRenderer.invoke('settings:setProfileBaseDir', dir),

    // ── Settings / Credentials ─────────────────────────────────
    setApiKey: (apiKey: string) => ipcRenderer.invoke('settings:setApiKey', apiKey),
    getCredentials: () => ipcRenderer.invoke('credentials:getAll'),
    addCredential: (data: { domain: string; label: string; username: string; password: string }) =>
        ipcRenderer.invoke('credentials:add', data),
    deleteCredential: (id: string) => ipcRenderer.invoke('credentials:delete', id),

    // ── Browser Profile Setup ──────────────────────────────────
    // Launches the system browser with a persistent profile so the user
    // can log in manually. Resolves when the browser is closed — session saved.
    setupBrowserProfile: (profileName: string, url?: string) =>
        ipcRenderer.invoke('browser:setupProfile', profileName, url),
    listBrowserProfiles: () => ipcRenderer.invoke('browser:listProfiles'),
    deleteBrowserProfile: (profileName: string) => ipcRenderer.invoke('browser:deleteProfile', profileName),
    getBrowserProfilesDir: () => ipcRenderer.invoke('browser:getProfilesDir'),

    // ── Realtime event listeners ───────────────────────────────
    onTaskUpdate: (callback: (event: unknown) => void) => {
        const handler = (_: Electron.IpcRendererEvent, data: unknown) => callback(data);
        ipcRenderer.on('task:update', handler);
        return () => ipcRenderer.removeListener('task:update', handler);
    },

    onTaskScreenshot: (callback: (event: unknown) => void) => {
        const handler = (_: Electron.IpcRendererEvent, data: unknown) => callback(data);
        ipcRenderer.on('task:screenshot', handler);
        return () => ipcRenderer.removeListener('task:screenshot', handler);
    },

    onTaskLogLine: (callback: (event: unknown) => void) => {
        const handler = (_: Electron.IpcRendererEvent, data: unknown) => callback(data);
        ipcRenderer.on('task:logLine', handler);
        return () => ipcRenderer.removeListener('task:logLine', handler);
    },

    onCaptchaDetected: (callback: (event: unknown) => void) => {
        const handler = (_: Electron.IpcRendererEvent, data: unknown) => callback(data);
        ipcRenderer.on('task:captcha', handler);
        return () => ipcRenderer.removeListener('task:captcha', handler);
    },

    onLearningComplete: (callback: (event: unknown) => void) => {
        const handler = (_: Electron.IpcRendererEvent, data: unknown) => callback(data);
        ipcRenderer.on('task:learningComplete', handler);
        return () => ipcRenderer.removeListener('task:learningComplete', handler);
    },
};

// Expose to renderer as window.electronAPI
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI);
        contextBridge.exposeInMainWorld('electronAPI', customAPI);
    } catch (error) {
        console.error(error);
    }
} else {
    // @ts-ignore (fallback)
    window.electron = electronAPI;
    // @ts-ignore
    window.electronAPI = customAPI;
}