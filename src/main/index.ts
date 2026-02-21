import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { DatabaseService, ensureReady } from './db/DatabaseService';
import { AgentController } from './agent/AgentController';
import { CredentialService } from './db/CredentialService';
import { PatternRepository } from './db/PatternRepository';
import { registerIpcHandlers } from './ipcHandlers';

let mainWindow: BrowserWindow | null = null;
let agentController: AgentController;

// ─── Create Window ────────────────────────────────────────────

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        frame: false,           // custom titlebar
        transparent: false,
        backgroundColor: '#0f1117',
        titleBarStyle: 'hidden',
        titleBarOverlay: false,
        show: false,
        icon: path.join(__dirname, '../../resources/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.on('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Dev: load vite dev server. Prod: load built index.html
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
}

// ─── App Lifecycle ────────────────────────────────────────────

app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.samrat.ai-browser-agent');
    app.on('browser-window-created', (_: unknown, window: BrowserWindow) => optimizer.watchWindowShortcuts(window));

    // Initialize database (sql.js is async)
    await ensureReady();
    const db = new DatabaseService();
    const credentialService = new CredentialService();
    const patternRepo = new PatternRepository(db);

    // Initialize agent controller
    agentController = new AgentController({ db, credentialService, patternRepo });

    // Wire agent events → renderer
    agentController.on('taskUpdate', (event) => {
        mainWindow?.webContents.send('task:update', event);
    });

    agentController.on('screenshot', (taskId: string, base64: string) => {
        mainWindow?.webContents.send('task:screenshot', { taskId, base64, timestamp: Date.now() });
    });

    agentController.on('logLine', (taskId: string, entry: unknown) => {
        mainWindow?.webContents.send('task:logLine', { taskId, entry });
    });

    agentController.on('captcha', (taskId: string, screenshotBase64: string, message: string) => {
        mainWindow?.webContents.send('task:captcha', { taskId, screenshotBase64, message });
    });

    agentController.on('learningComplete', (taskId: string, data: unknown) => {
        mainWindow?.webContents.send('task:learningComplete', { taskId, data });
    });

    // Register all IPC handlers
    registerIpcHandlers(ipcMain, agentController, db, credentialService, patternRepo);

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
