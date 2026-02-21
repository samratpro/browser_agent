import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// ─── App Settings (persisted as JSON) ────────────────────────
// Stored at: userData/settings.json
// Separate from the SQLite DB — human-readable and easy to back up.

export interface AppSettings {
    profileBaseDir?: string;   // Custom browser profile storage folder
    defaultBrowserType?: string;
    [key: string]: string | undefined; // allow arbitrary string keys
}

const DEFAULTS: AppSettings = {
    profileBaseDir: undefined,
    defaultBrowserType: 'chromium',
};

export class SettingsStore {
    private filePath: string;
    private data: AppSettings;

    constructor() {
        this.filePath = path.join(app.getPath('userData'), 'settings.json');
        this.data = this.load();
    }

    private load(): AppSettings {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf-8');
                return { ...DEFAULTS, ...JSON.parse(raw) };
            }
        } catch {
            // corrupt file — start fresh
        }
        return { ...DEFAULTS };
    }

    private save(): void {
        try {
            fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
        } catch (e) {
            console.error('[SettingsStore] Failed to save:', e);
        }
    }

    get(key: string): string | null {
        return this.data[key] ?? null;
    }

    set(key: string, value: string | null): void {
        if (value === null) {
            delete this.data[key];
        } else {
            this.data[key] = value;
        }
        this.save();
    }

    getAll(): AppSettings {
        return { ...this.data };
    }
}