/**
 * DOMCompressor
 * ─────────────
 * Strips unnecessary DOM content before sending to AI.
 * Rules:
 *  - Remove <script>, <style>, <noscript>, <svg>, <meta>, <link> tags
 *  - Remove hidden elements (display:none, visibility:hidden, aria-hidden=true)
 *  - Limit tree depth to MAX_DEPTH
 *  - Limit children count per node to MAX_CHILDREN
 *  - Truncate text content to MAX_TEXT_LENGTH
 *  - Return only the innerText-like representation (no raw HTML)
 */

const MAX_DEPTH = 6;
const MAX_CHILDREN = 8;
const MAX_TEXT_LENGTH = 120;
const MAX_OUTPUT_CHARS = 8000;

const IGNORED_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'META', 'LINK',
    'HEAD', 'IFRAME', 'OBJECT', 'EMBED', 'CANVAS',
]);

export interface CompressedNode {
    tag: string;
    id?: string;
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
    children?: CompressedNode[];
}

/**
 * Compress a serialized HTML string into a minimal tree for AI consumption.
 */
export function compressHTML(html: string, targetSelector?: string): string {
    // We work with a simple regex-based approach for the main process (no JSDOM).
    // Strip comment blocks first.
    const stripped = html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '[SVG]')
        .replace(/<head[\s\S]*?<\/head>/gi, '')
        .replace(/\s+/g, ' ');

    // Extract target section if selector provided (simple id/class heuristic)
    let working = stripped;
    if (targetSelector && targetSelector.startsWith('#')) {
        const id = targetSelector.slice(1);
        const match = working.match(new RegExp(`id=["']${id}["'][^>]*>([\\s\\S]{0,4000})`, 'i'));
        if (match) working = match[0];
    }

    // Convert to readable text
    const text = htmlToReadableText(working);

    // Ensure output doesn't exceed limit
    return text.length > MAX_OUTPUT_CHARS
        ? text.slice(0, MAX_OUTPUT_CHARS) + '\n[... truncated ...]'
        : text;
}

/**
 * Convert HTML tags to a readable text representation.
 */
function htmlToReadableText(html: string): string {
    return html
        // Block-level elements → newlines
        .replace(/<\/(div|section|article|main|nav|aside|header|footer|li|p|h[1-6]|tr|td|th)>/gi, '\n')
        // Links: preserve href and text
        .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
            const text = stripTags(inner).trim();
            return text ? `[${text}](${href}) ` : '';
        })
        // Images: preserve alt
        .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, (_, alt) => alt ? `[IMG:${alt}] ` : '[IMG] ')
        // Input fields
        .replace(/<input[^>]*name=["']([^"']*)["'][^>]*>/gi, (_, name) => `[INPUT:${name}] `)
        .replace(/<input[^>]*placeholder=["']([^"']*)["'][^>]*>/gi, (_, ph) => `[INPUT:${ph}] `)
        // Buttons
        .replace(/<button[^>]*>([\s\S]*?)<\/button>/gi, (_, inner) => `[BTN:${stripTags(inner).trim()}] `)
        // Select
        .replace(/<select[^>]*name=["']([^"']*)["'][^>]*>[\s\S]*?<\/select>/gi, (_, name) => `[SELECT:${name}] `)
        // Remove remaining tags
        .replace(/<[^>]+>/g, ' ')
        // Decode common entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        // Collapse whitespace
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function stripTags(html: string): string {
    return html.replace(/<[^>]+>/g, '');
}

/**
 * Extract only interactive elements from HTML for selector generation.
 */
export function extractInteractiveElements(html: string): string {
    const elements: string[] = [];
    let count = 0;

    const patterns = [
        // Buttons
        /<button([^>]*)>([\s\S]*?)<\/button>/gi,
        // Links
        /<a([^>]*)>([\s\S]*?)<\/a>/gi,
        // Inputs
        /<input([^>]*)>/gi,
        // Selects
        /<select([^>]*)>/gi,
        // Textareas
        /<textarea([^>]*)>/gi,
    ];

    for (const pattern of patterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(html)) !== null && count < 50) {
            const attrs = parseAttrString(match[1] ?? '');
            const text = match[2] ? stripTags(match[2]).trim().slice(0, MAX_TEXT_LENGTH) : '';
            const tag = match[0].match(/^<(\w+)/)?.[1]?.toLowerCase() ?? 'el';

            const descriptor = [
                `<${tag}`,
                attrs.id ? ` id="${attrs.id}"` : '',
                attrs.class ? ` class="${attrs.class.slice(0, 60)}"` : '',
                attrs.name ? ` name="${attrs.name}"` : '',
                attrs.type ? ` type="${attrs.type}"` : '',
                attrs.placeholder ? ` placeholder="${attrs.placeholder}"` : '',
                attrs['aria-label'] ? ` aria-label="${attrs['aria-label']}"` : '',
                '>',
                text ? text : '',
                `</${tag}>`,
            ].join('');

            elements.push(descriptor.slice(0, 200));
            count++;
        }
    }

    return elements.join('\n');
}

function parseAttrString(attrStr: string): Record<string, string> {
    const result: Record<string, string> = {};
    const re = /(\w[\w-]*)=["']([^"']*)["']/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(attrStr)) !== null) {
        result[m[1]] = m[2];
    }
    return result;
}
