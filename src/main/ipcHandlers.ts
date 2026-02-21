import { IpcMain, shell, BrowserWindow, dialog, app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { AgentController } from './agent/AgentController';
import { DatabaseService } from './db/DatabaseService';
import { CredentialService } from './db/CredentialService';
import { PatternRepository } from './db/PatternRepository';
import { BrowserProfileService } from './agent/BrowserProfileService';
import { SettingsStore } from './SettingsStore';
import { BrowserConfig } from '../shared/types/AgentTypes';

// ─── All IPC Handler Registration ────────────────────────────

export function registerIpcHandlers(
    ipcMain: IpcMain,
    agentController: AgentController,
    db: DatabaseService,
    credentialService: CredentialService,
    patternRepo: PatternRepository,
): void {

    // JSON settings file — persisted at userData/settings.json
    const settings = new SettingsStore();

    // ── Window Controls ─────────────────────────────────────────

    ipcMain.on('window:minimize', () => {
        BrowserWindow.getFocusedWindow()?.minimize();
    });

    ipcMain.on('window:maximize', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win?.isMaximized()) win.unmaximize();
        else win?.maximize();
    });

    ipcMain.on('window:close', () => {
        BrowserWindow.getFocusedWindow()?.close();
    });

    ipcMain.handle('window:isMaximized', () => {
        return BrowserWindow.getFocusedWindow()?.isMaximized() ?? false;
    });

    // ── KV Store ────────────────────────────────────────────────

    ipcMain.handle('db:get', (_event, key: string) => {
        return db.kvGet(key);
    });

    ipcMain.handle('db:set', (_event, key: string, value: string | null) => {
        db.kvSet(key, value);
    });

    // ── External Links ──────────────────────────────────────────

    ipcMain.handle('shell:openExternal', (_event, url: string) => {
        shell.openExternal(url);
    });

    // ── Native Folder Dialog ────────────────────────────────────

    ipcMain.handle('dialog:openFolder', async (_event, defaultPath?: string) => {
        const win = BrowserWindow.getFocusedWindow();
        const result = await dialog.showOpenDialog(win ?? BrowserWindow.getAllWindows()[0], {
            properties: ['openDirectory', 'createDirectory'],
            defaultPath: defaultPath ?? app.getPath('documents'),
        });
        if (result.canceled || !result.filePaths.length) return null;
        return result.filePaths[0];
    });

    // ── Browser Profile Settings (JSON file) ───────────────────

    ipcMain.handle('settings:getProfileBaseDir', () => {
        return settings.get('profileBaseDir');
    });

    ipcMain.handle('settings:setProfileBaseDir', (_event, dir: string | null) => {
        settings.set('profileBaseDir', dir);
    });

    ipcMain.handle('settings:getAll', () => {
        return settings.getAll();
    });

    ipcMain.handle('settings:set', (_event, key: string, value: string | null) => {
        settings.set(key, value);
    });

    // ── Task Control ────────────────────────────────────────────

    // Helper: resolve BrowserProfileService using the user-configured base dir
    const getBrowserProfileService = () => {
        return new BrowserProfileService(settings.get('profileBaseDir') ?? undefined);
    };

    ipcMain.handle('task:run', async (_event, params: {
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
    }) => {
        const { prompt, url, email, password, twoFactorCode, browserConfig: rawConfig, resourceFolder } = params;
        let domain = '';
        try { domain = new URL(url).hostname; } catch { domain = url; }

        // Resolve profile path from profile name using the configured base dir
        let resolvedConfig: BrowserConfig | undefined;
        if (rawConfig) {
            const svc = getBrowserProfileService();
            resolvedConfig = {
                browserType: (rawConfig.browserType as BrowserConfig['browserType']) ?? 'chromium',
                headless: rawConfig.headless,
                profileName: rawConfig.profileName,
                profilePath: rawConfig.profileName?.trim()
                    ? svc.getProfilePath(rawConfig.profileName.trim())
                    : undefined,
                proxy: rawConfig.proxy,
                debugPort: rawConfig.debugPort,
                resourceFolder,
            };
        } else if (resourceFolder) {
            resolvedConfig = { resourceFolder };
        }

        const taskId = agentController.createTaskRecord(prompt, domain, {
            url, email, password, twoFactorCode,
        });

        // Run non-blocking
        void agentController.runTask(taskId, prompt, url, {
            url, email, password, twoFactorCode,
        }, resolvedConfig);

        return { taskId };
    });

    ipcMain.handle('task:interrupt', (_event, taskId: string, message: string) => {
        agentController.interruptTask(taskId, message);
    });

    ipcMain.handle('task:pause', (_event, taskId: string) => {
        return agentController.pauseTask(taskId);
    });

    ipcMain.handle('task:resume', (_event, taskId: string) => {
        return agentController.resumeTask(taskId);
    });

    ipcMain.handle('task:stop', (_event, taskId: string) => {
        return agentController.stopTask(taskId);
    });

    ipcMain.handle('task:delete', (_event, taskId: string) => {
        agentController.stopTask(taskId);
        db.run('DELETE FROM logs WHERE task_id = ?', [taskId]);
        db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
        return true;
    });

    ipcMain.handle('task:confirmLearning', (_event, taskId: string) => {
        agentController.confirmLearning(taskId);
    });

    ipcMain.handle('task:overrideCaptcha', (_event, taskId: string) => {
        agentController.overrideCaptcha(taskId);
    });

    // ── Task Queries ────────────────────────────────────────────

    ipcMain.handle('task:getAll', () => {
        return db.all(
            'SELECT * FROM tasks ORDER BY created_at DESC LIMIT 100',
        );
    });

    ipcMain.handle('task:getLogs', (_event, taskId: string) => {
        return db.all('SELECT * FROM logs WHERE task_id = ? ORDER BY timestamp ASC LIMIT 500', [taskId]);
    });

    // ── Dashboard Stats ─────────────────────────────────────────

    ipcMain.handle('dashboard:getStats', () => {
        const activeTasks = (db.get<{ c: number }>(`SELECT COUNT(*) as c FROM tasks WHERE state IN ('EXECUTING','PLANNING','EXPLORING','LEARNING','PAUSED','WAITING_USER')`) ?? { c: 0 }).c;
        const completedTasks = (db.get<{ c: number }>(`SELECT COUNT(*) as c FROM tasks WHERE state = 'COMPLETED'`) ?? { c: 0 }).c;
        const failedTasks = (db.get<{ c: number }>(`SELECT COUNT(*) as c FROM tasks WHERE state = 'FAILED'`) ?? { c: 0 }).c;
        const totalPatterns = (db.get<{ c: number }>(`SELECT COUNT(*) as c FROM patterns`) ?? { c: 0 }).c;
        const patternSuccessRate = (db.get<{ r: number }>(`SELECT AVG(success_rate) as r FROM patterns`) ?? { r: 0 }).r ?? 0;
        const recentActivity = db.all('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 20');

        return { activeTasks, completedTasks, failedTasks, totalPatterns, patternSuccessRate, recentActivity };
    });

    // ── Patterns ────────────────────────────────────────────────

    ipcMain.handle('pattern:getAll', () => {
        return patternRepo.getAll();
    });

    ipcMain.handle('pattern:setDisabled', (_event, id: string, disabled: boolean) => {
        patternRepo.setDisabled(id, disabled);
    });

    ipcMain.handle('pattern:delete', (_event, id: string) => {
        patternRepo.delete(id);
    });

    ipcMain.handle('pattern:getVersions', (_event, id: string) => {
        return patternRepo.getVersions(id);
    });

    ipcMain.handle('pattern:forceRelearn', (_event, id: string) => {
        patternRepo.setDisabled(id, true);
        return true;
    });

    // ── Schedules ───────────────────────────────────────────────

    ipcMain.handle('schedule:getAll', () => {
        return db.all(`
      SELECT s.*, p.name as pattern_name, p.domain
      FROM schedules s
      LEFT JOIN patterns p ON p.id = s.pattern_id
      ORDER BY s.created_at DESC
    `);
    });

    ipcMain.handle('schedule:create', (_event, data: {
        name: string; patternId: string; cronExpression: string;
    }) => {
        const id = uuidv4();
        const now = Date.now();
        db.run(
            `INSERT INTO schedules (id,name,pattern_id,cron_expression,is_enabled,created_at,updated_at)
       VALUES (?,?,?,?,1,?,?)`,
            [id, data.name, data.patternId, data.cronExpression, now, now],
        );
        return id;
    });

    ipcMain.handle('schedule:toggle', (_event, id: string, enabled: boolean) => {
        db.run('UPDATE schedules SET is_enabled = ?, updated_at = ? WHERE id = ?', [
            enabled ? 1 : 0, Date.now(), id,
        ]);
    });

    ipcMain.handle('schedule:delete', (_event, id: string) => {
        db.run('DELETE FROM schedules WHERE id = ?', [id]);
    });

    ipcMain.handle('schedule:getRuns', (_event, scheduleId: string) => {
        return db.all(
            'SELECT * FROM schedule_runs WHERE schedule_id = ? ORDER BY started_at DESC LIMIT 50',
            [scheduleId],
        );
    });

    // ── Settings ────────────────────────────────────────────────

    ipcMain.handle('settings:setApiKey', async (_event, apiKey: string) => {
        await credentialService.setApiKey(apiKey);
    });

    // ── Credentials ─────────────────────────────────────────────

    ipcMain.handle('credentials:getAll', () => {
        return db.all('SELECT id,domain,label,username,created_at,updated_at FROM credentials ORDER BY created_at DESC');
    });

    ipcMain.handle('credentials:add', async (_event, data: {
        domain: string; label: string; username: string; password: string;
    }) => {
        const id = uuidv4();
        const now = Date.now();
        db.run(
            'INSERT INTO credentials (id,domain,label,username,created_at,updated_at) VALUES (?,?,?,?,?,?)',
            [id, data.domain, data.label, data.username, now, now],
        );
        await credentialService.setPassword(id, data.password);
        return id;
    });

    ipcMain.handle('credentials:delete', async (_event, id: string) => {
        await credentialService.deletePassword(id);
        db.run('DELETE FROM credentials WHERE id = ?', [id]);
    });

    // ── Browser Profile Setup ────────────────────────────────────

    ipcMain.handle('browser:setupProfile', async (_event, profileName: string, url?: string) => {
        return getBrowserProfileService().setupProfile(profileName, url);
    });

    ipcMain.handle('browser:listProfiles', () => {
        return getBrowserProfileService().listProfiles();
    });

    ipcMain.handle('browser:deleteProfile', (_event, profileName: string) => {
        getBrowserProfileService().deleteProfile(profileName);
        return true;
    });

    ipcMain.handle('browser:getProfilesDir', () => {
        return getBrowserProfileService().getBaseDir();
    });
}