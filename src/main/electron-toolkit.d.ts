declare module '@electron-toolkit/utils' {
    import { BrowserWindow, IpcMainInvokeEvent, IpcMainEvent } from 'electron';

    interface Is {
        dev: boolean;
    }
    export const is: Is;

    interface Platform {
        isWindows: boolean;
        isMacOS: boolean;
        isLinux: boolean;
    }
    export const platform: Platform;

    interface ElectronApp {
        setAppUserModelId: (id: string) => void;
        setAutoLaunch: (auto: boolean) => boolean;
        skipProxy: () => Promise<void>;
    }
    export const electronApp: ElectronApp;

    interface Optimizer {
        watchWindowShortcuts: (window: BrowserWindow, shortcutOptions?: { escToCloseWindow?: boolean; zoom?: boolean }) => void;
        registerFramelessWindowIpc: () => void;
    }
    export const optimizer: Optimizer;
}
