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
    async setupProfile(
        profileName: string,
        url?: string,
        browserType: string = 'chrome',
        proxy?: { server: string; username?: string; password?: string }
    ): Promise<{ success: boolean; profilePath: string }> {
        const profilePath = this.getProfilePath(profileName);

        const browserPath = this.findBrowserPath(browserType);
        if (!browserPath) {
            throw new Error(
                `Could not find ${browserType}. Please ensure it is installed.`
            );
        }

        const args = browserType === 'firefox' ? [
            '-profile', profilePath,
            '-no-remote'
        ] : [
            `--user-data-dir=${profilePath}`,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-blink-features=AutomationControlled',
        ];

        if (browserType === 'brave') {
            args.push('--disable-features=BraveShields');
        }

        if (proxy?.server && browserType !== 'firefox') {
            args.push(`--proxy-server=${proxy.server}`);
        }
        // Firefox proxy config usually requires prefs.js manipulation or separate extensions
        // but for now we'll stick to basic launch.

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

    private findBrowserPath(type: string = 'chrome'): string | null {
        const platform = os.platform();
        const home = os.homedir();
        const candidates: string[] = [];

        if (platform === 'win32') {
            if (type === 'chrome') {
                candidates.push(
                    path.join(home, 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
                );
            } else if (type === 'edge') {
                candidates.push(
                    path.join(home, 'AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe'),
                    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
                );
            } else if (type === 'brave') {
                candidates.push(
                    path.join(home, 'AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
                    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
                    'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
                );
            } else if (type === 'firefox') {
                candidates.push(
                    'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
                    'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
                    path.join(home, 'AppData\\Local\\Mozilla Firefox\\firefox.exe')
                );
            } else if (type === 'comet') {
                candidates.push(path.join(home, 'AppData\\Local\\CometBrowser\\Application\\comet.exe'));
            } else if (type === 'chromium') {
                candidates.push(path.join(home, 'AppData\\Local\\Chromium\\Application\\chromium.exe'));
            }
        } else if (platform === 'darwin') {
            if (type === 'chrome') candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
            else if (type === 'brave') candidates.push('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser');
            else if (type === 'edge') candidates.push('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
            else if (type === 'firefox') candidates.push('/Applications/Firefox.app/Contents/MacOS/firefox');
            else if (type === 'chromium') candidates.push('/Applications/Chromium.app/Contents/MacOS/Chromium');
        } else {
            if (type === 'chrome') candidates.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable');
            else if (type === 'brave') candidates.push('/usr/bin/brave-browser');
            else if (type === 'edge') candidates.push('/usr/bin/microsoft-edge');
            else if (type === 'firefox') candidates.push('/usr/bin/firefox');
            else if (type === 'chromium') candidates.push('/usr/bin/chromium-browser', '/usr/bin/chromium');
        }

        return candidates.find((p) => fs.existsSync(p)) ?? null;
    }
}