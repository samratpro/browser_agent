import { Page } from 'playwright';
import Fuse from 'fuse.js';
import {
    Action,
    RecoveryContext,
    RecoveryResult,
    SelectorEntry,
} from '../../shared/types/AgentTypes';
import { compressHTML } from './DOMCompressor';
import { AIPlanner } from './AIPlanner';

// ─── DOM Fingerprint ──────────────────────────────────────────

export interface DOMFingerprint {
    tagName: string;
    id: string;
    classNames: string[];
    textContent: string;
    parentTag: string;
    siblingIndex: number;
    attrs: Record<string, string>;
}

// ─── SelectorRecovery ─────────────────────────────────────────

export class SelectorRecovery {
    constructor(private aiPlanner: AIPlanner) { }

    /**
     * 4-stage recovery pipeline:
     * 1. Fuzzy CSS class match
     * 2. Text-based search
     * 3. DOM fingerprint similarity
     * 4. AI fallback
     */
    async recover(
        page: Page,
        ctx: RecoveryContext,
        knownSelectors: SelectorEntry[],
    ): Promise<RecoveryResult> {
        // Stage 1: Fuzzy class similarity
        const stage1 = await this.tryFuzzyClassMatch(page, ctx.failedSelector);
        if (stage1) {
            return { recovered: true, newSelector: stage1, strategy: 'fuzzy' };
        }

        // Stage 2: Text-based search
        const stage2 = await this.tryTextSearch(page, ctx.failedAction);
        if (stage2) {
            return { recovered: true, newSelector: stage2, strategy: 'text' };
        }

        // Stage 3: DOM fingerprint similarity
        const stage3 = await this.tryFingerprintMatch(page, ctx.failedSelector, knownSelectors);
        if (stage3) {
            return { recovered: true, newSelector: stage3, strategy: 'fingerprint' };
        }

        // Stage 4: AI fallback
        const stage4 = await this.tryAIRecovery(page, ctx);
        if (stage4) {
            return { recovered: true, newSelector: stage4, strategy: 'ai' };
        }

        return { recovered: false, strategy: 'none' };
    }

    // ── Stage 1: Fuzzy css class match ──────────────────────────

    private async tryFuzzyClassMatch(
        page: Page,
        failedSelector: string,
    ): Promise<string | null> {
        try {
            // Extract class names from failed selector
            const classMatch = failedSelector.match(/\.([\w-]+)/g);
            if (!classMatch) return null;

            const targetClasses = classMatch.map((c) => c.slice(1));

            // Collect all elements with class attributes from DOM
            const elements = await page.$$eval('*[class]', (els: Element[]) =>
                els.slice(0, 200).map((el) => ({
                    tag: el.tagName.toLowerCase(),
                    classes: (el as HTMLElement).className.split(/\s+/).filter(Boolean),
                    id: el.id || '',
                })),
            );

            // Fuzzy match using class overlap
            const scored = elements.map((el) => {
                const overlap = el.classes.filter((c) =>
                    targetClasses.some((tc) => fuzzyMatchClass(tc, c)),
                ).length;
                const score = overlap / Math.max(targetClasses.length, 1);
                return { el, score };
            });

            const best = scored.sort((a, b) => b.score - a.score)[0];
            if (best && best.score >= 0.6) {
                const { el } = best;
                if (el.id) return `#${el.id}`;
                const cls = el.classes.slice(0, 2).join('.');
                return `${el.tag}.${cls}`;
            }
            return null;
        } catch {
            return null;
        }
    }

    // ── Stage 2: Text-based search ───────────────────────────────

    private async tryTextSearch(page: Page, failedAction: Action): Promise<string | null> {
        try {
            // Extract meaningful text from action
            let searchText: string | null = null;

            if (failedAction.type === 'click') {
                // Try to guess button/link text from selector
                const textMatch = failedAction.selector.match(/text=["']?([^"']+)["']?/);
                if (textMatch) searchText = textMatch[1];
            } else if (failedAction.type === 'type' || failedAction.type === 'extract') {
                // Try placeholder or label guess
                const labelMatch = failedAction.selector.match(/\[placeholder=["']?([^"']+)["']?\]/);
                if (labelMatch) searchText = labelMatch[1];
            }

            if (!searchText) return null;

            // Find element by text content using Playwright
            const handle = await page.locator(`text="${searchText}"`).first().elementHandle({ timeout: 2000 }).catch(() => null);
            if (!handle) return null;

            const selector = await page.evaluate((el) => {
                if (el.id) return `#${el.id}`;
                const tag = el.tagName.toLowerCase();
                const cls = (el.className || '').split(/\s+/).slice(0, 2).join('.');
                return cls ? `${tag}.${cls}` : tag;
            }, handle);

            return selector || null;
        } catch {
            return null;
        }
    }

    // ── Stage 3: DOM fingerprint similarity ──────────────────────

    private async tryFingerprintMatch(
        page: Page,
        failedSelector: string,
        knownSelectors: SelectorEntry[],
    ): Promise<string | null> {
        try {
            if (!knownSelectors.length) return null;

            // Build fingerprints for current DOM elements
            const currentFingerprints = await page.$$eval('button, a, input, select, textarea, [role]', (els: Element[]) =>
                els.slice(0, 150).map((el) => ({
                    tagName: el.tagName.toLowerCase(),
                    id: el.id || '',
                    classNames: (el as HTMLElement).className ? (el as HTMLElement).className.split(/\s+/).filter(Boolean) : [],
                    textContent: (el.textContent || '').trim().slice(0, 60),
                    parentTag: el.parentElement?.tagName.toLowerCase() || '',
                    siblingIndex: Array.from(el.parentElement?.children || []).indexOf(el as Element),
                    attrs: Object.fromEntries(
                        Array.from(el.attributes)
                            .slice(0, 5)
                            .map((a) => [a.name, a.value.slice(0, 50)]),
                    ),
                })),
            );

            const fuse = new Fuse(currentFingerprints, {
                keys: ['classNames', 'textContent', 'parentTag'],
                threshold: 0.4,
            });

            for (const known of knownSelectors) {
                if (!known.fingerprint) continue;
                const results = fuse.search(known.fingerprint);
                if (results.length > 0) {
                    const fp = results[0].item;
                    if (fp.id) return `#${fp.id}`;
                    const cls = fp.classNames.slice(0, 2).join('.');
                    return cls ? `${fp.tagName}.${cls}` : fp.tagName;
                }
            }

            return null;
        } catch {
            return null;
        }
    }

    // ── Stage 4: AI fallback ──────────────────────────────────────

    private async tryAIRecovery(page: Page, ctx: RecoveryContext): Promise<string | null> {
        try {
            const html = await page.content();
            const compressedDOM = compressHTML(html);
            const result = await this.aiPlanner.suggestRecoverySelector({
                ...ctx,
                compressedDOM,
            });
            return result.newSelector ?? null;
        } catch {
            return null;
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────

function fuzzyMatchClass(a: string, b: string): boolean {
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    // Levenshtein distance <= 2 for short strings
    if (Math.abs(a.length - b.length) > 3) return false;
    return levenshtein(a, b) <= 2;
}

function levenshtein(a: string, b: string): number {
    const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
        Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[a.length][b.length];
}

export function generateFingerprint(el: DOMFingerprint): string {
    return [
        el.tagName,
        el.classNames.slice(0, 3).join('|'),
        el.textContent.slice(0, 30),
        el.parentTag,
        el.siblingIndex,
    ].join('::');
}
