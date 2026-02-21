import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { app } from 'electron';

// ─── BrowserProfileService ────────────────────────────────────
// Launches a real system browser with a persistent user-data-dir
// so the user can manually log in, set cookies, etc.
// When the browser is closed, the session is saved automatically
// (Chrome/Edge/Brave store session data in the profile directory).

export class BrowserProfileService {
    private baseDir: string;

    constructor(customBaseDir?: string) {
        // Use user-configured path, or default alongside app userData
        this.baseDir = customBaseDir ?? path.join(app.getPath('userData'), 'BrowserProfiles');
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
    }

    getBaseDir(): string {
        return this.baseDir;
    }

    getProfilePath(profileName: string): string {
        return path.join(this.baseDir, profileName.replace(/[^a-zA-Z0-9_-]/g, '_'));
    }

    listProfiles(): Array<{ name: string; path: string; createdAt: number }> {
        if (!fs.existsSync(this.baseDir)) return [];
        return fs.readdirSync(this.baseDir)
            .filter((f) => fs.statSync(path.join(this.baseDir, f)).isDirectory())
            .map((name) => ({
                name,
                path: path.join(this.baseDir, name),
                createdAt: fs.statSync(path.join(this.baseDir, name)).birthtimeMs,
            }));
    }

    profileExists(profileName: string): boolean {
        return fs.existsSync(this.getProfilePath(profileName));
    }

    deleteProfile(profileName: string): void {
        const profilePath = this.getProfilePath(profileName);
        if (fs.existsSync(profilePath)) {
            fs.rmSync(profilePath, { recursive: true, force: true });
        }
    }

    // Launch browser → user does manual actions → close → session saved
    async setupProfile(profileName: string, url?: string): Promise<{ success: boolean; profilePath: string }> {
        const profilePath = this.getProfilePath(profileName);

        const browserPath = this.findBrowserPath();
        if (!browserPath) {
            throw new Error(
                'No supported browser found. Please install Google Chrome, Microsoft Edge, or Brave Browser.'
            );
        }

        const args = [
            `--user-data-dir=${profilePath}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-features=BraveShields',
        ];

        if (url) args.push(url);

        await new Promise<void>((resolve, reject) => {
            const proc = spawn(browserPath, args, {
                detached: false,
                stdio: 'ignore',
            });
            proc.on('close', () => resolve());
            proc.on('error', (err) => reject(err));
        });

        return { success: true, profilePath };
    }

    private findBrowserPath(): string | null {
        const platform = os.platform();
        const candidates: string[] = [];

        if (platform === 'win32') {
            const home = os.homedir();
            candidates.push(
                // Chrome
                path.join(home, 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                // Edge
                path.join(home, 'AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe'),
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
                // Brave
                path.join(home, 'AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
                'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
                'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
                // Comet
                path.join(home, 'AppData\\Local\\CometBrowser\\Application\\comet.exe'),
                // Chromium
                path.join(home, 'AppData\\Local\\Chromium\\Application\\chromium.exe'),
            );
        } else if (platform === 'darwin') {
            candidates.push(
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
                '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
                '/Applications/Chromium.app/Contents/MacOS/Chromium',
            );
        } else {
            candidates.push(
                '/usr/bin/google-chrome',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/brave-browser',
                '/usr/bin/microsoft-edge',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium',
            );
        }

        return candidates.find((p) => fs.existsSync(p)) ?? null;
    }
}