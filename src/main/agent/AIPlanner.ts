import OpenAI from 'openai';
import { CredentialService, sanitizeForAI } from '../db/CredentialService';
import {
    Action,
    PlannerRequest,
    PlannerResponse,
    TaskIntent,
    SelectorEntry,
    RecoveryContext,
    RecoveryResult,
} from '../../shared/types/AgentTypes';

export class AIPlanner {
    private client: OpenAI | null = null;
    private credentialService: CredentialService;

    constructor(credentialService: CredentialService) {
        this.credentialService = credentialService;
    }

    private async getClient(): Promise<OpenAI> {
        if (this.client) return this.client;
        const apiKey = await this.credentialService.getApiKey();
        if (!apiKey) throw new Error('OpenAI API key not configured. Please add it in Settings.');
        this.client = new OpenAI({ apiKey });
        return this.client;
    }

    // ─── Intent Classification ─────────────────────────────────

    async classifyIntent(prompt: string): Promise<TaskIntent> {
        const client = await this.getClient();
        const response = await client.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0,
            max_tokens: 20,
            messages: [
                {
                    role: 'system',
                    content: `Classify the user's browser automation intent into exactly one of these categories:
scrape, test, login, monitor, automate

Respond with ONLY the category word, nothing else.`,
                },
                { role: 'user', content: prompt },
            ],
        });
        const raw = response.choices[0]?.message?.content?.trim().toLowerCase() ?? 'automate';
        const valid: TaskIntent[] = ['scrape', 'test', 'login', 'monitor', 'automate'];
        return valid.includes(raw as TaskIntent) ? (raw as TaskIntent) : 'automate';
    }

    // ─── Action Planning ───────────────────────────────────────

    async planActions(request: PlannerRequest): Promise<PlannerResponse> {
        const client = await this.getClient();

        const systemPrompt = `You are a browser automation planner. Generate a precise action plan.
RULES:
- NEVER include credentials in selectors or actions.
- Use specific CSS selectors, ARIA labels, or role-based selectors.
- Keep actions minimal and deterministic.
- Respond ONLY with valid JSON matching the Action type schema.

Action types:
- { "type": "navigate", "url": "..." }
- { "type": "click", "selector": "..." }
- { "type": "type", "selector": "...", "value": "..." }
- { "type": "extract", "selector": "...", "field": "..." }
- { "type": "loop", "selector": "...", "actions": [...] }
- { "type": "assert", "selector": "...", "expected": "..." }
- { "type": "wait", "ms": 1000 }
- { "type": "screenshot" }
- { "type": "scroll", "direction": "down" }

Respond with JSON: { "actions": [...], "reasoning": "..." }`;

        const userContent = [
            `Task: ${request.prompt}`,
            `Intent: ${request.intent}`,
            `Current URL: ${request.currentUrl}`,
            request.compressedDOM ? `\nPage content:\n${request.compressedDOM}` : '',
            request.errorContext ? `\nError context: ${sanitizeForAI(request.errorContext)}` : '',
        ]
            .filter(Boolean)
            .join('\n');

        const response = await client.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.2,
            max_tokens: 2000,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
            ],
        });

        const content = response.choices[0]?.message?.content ?? '{"actions":[]}';
        try {
            const parsed = JSON.parse(content) as { actions: Action[]; reasoning?: string };
            return {
                actions: parsed.actions ?? [],
                reasoning: parsed.reasoning,
            };
        } catch {
            return { actions: [] };
        }
    }

    // ─── Exploration Planning ──────────────────────────────────

    async planExploration(
        prompt: string,
        currentUrl: string,
        compressedDOM: string,
        sampleCount: number = 5,
    ): Promise<PlannerResponse> {
        const client = await this.getClient();

        const systemPrompt = `You are exploring a web page to learn its structure for automation.
Generate a MINIMAL set of actions to sample ${sampleCount} items from a list/table/feed.
Focus on DISCOVERING selectors, not completing the full task.
Respond with JSON: { "actions": [...], "selectorSuggestions": [...], "reasoning": "..." }

For selectorSuggestions, use: { "field": "...", "selector": "...", "selectorType": "css", "confidence": 0.9, "lastVerifiedAt": 0 }`;

        const response = await client.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.3,
            max_tokens: 1500,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: `Task: ${prompt}\nURL: ${currentUrl}\n\nPage:\n${compressedDOM}`,
                },
            ],
        });

        const content = response.choices[0]?.message?.content ?? '{"actions":[]}';
        try {
            const parsed = JSON.parse(content) as {
                actions: Action[];
                selectorSuggestions?: SelectorEntry[];
                reasoning?: string;
            };
            return {
                actions: parsed.actions ?? [],
                selectorSuggestions: parsed.selectorSuggestions,
                reasoning: parsed.reasoning,
            };
        } catch {
            return { actions: [] };
        }
    }

    // ─── Selector Recovery ─────────────────────────────────────

    async suggestRecoverySelector(ctx: RecoveryContext): Promise<Partial<RecoveryResult>> {
        const client = await this.getClient();

        const systemPrompt = `A browser automation selector has failed. Suggest an alternative selector.
The page has changed structure. Analyse the compressed DOM and suggest the best CSS selector.
Respond with JSON: { "newSelector": "...", "reasoning": "...", "confidence": 0.0-1.0 }`;

        const safeDOM = sanitizeForAI(ctx.compressedDOM);

        const response = await client.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0,
            max_tokens: 400,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: `Failed selector: ${ctx.failedSelector}\nURL: ${ctx.currentUrl}\n\nDOM:\n${safeDOM}`,
                },
            ],
        });

        const content = response.choices[0]?.message?.content ?? '{}';
        try {
            const parsed = JSON.parse(content) as { newSelector?: string; confidence?: number };
            return { newSelector: parsed.newSelector, strategy: 'ai' };
        } catch {
            return {};
        }
    }

    // Invalidate client if API key changes
    resetClient(): void {
        this.client = null;
    }
}
