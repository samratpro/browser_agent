import { BrowserManager } from 'ts_playwright_browser_manager';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// ─── BrowserProfileService ────────────────────────────────────
// Launches a real system browser with a persistent user-data-dir
// so the user can manually log in, set cookies, etc.
// Uses the standardized ts_playwright_browser_manager package.

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
    // Now powered by ts_playwright_browser_manager for better anti-detection
    async setupProfile(
        profileName: string,
        url?: string,
        browserType: string = 'chrome',
        _proxy?: { server: string; username?: string; password?: string }
    ): Promise<{ success: boolean; profilePath: string }> {
        const manager = new BrowserManager({
            baseProfileDir: this.baseDir,
            // Use a specific port for setup to avoid clashing with active tasks
            debugPort: 9333 
        });

        const waitMessage = 'Please login and close the browser manually when finished to save your session.';
        
        // Use the native package's setupProfile method which handles all args correctly
        await manager.setupProfile(
            profileName,
            url || 'https://google.com',
            waitMessage
        );

        return { 
            success: true, 
            profilePath: this.getProfilePath(profileName) 
        };
    }
}