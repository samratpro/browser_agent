/**
 * Beta Expiration Lock Utility
 * ─────────────────────────────────────────────────────────────
 * Verifies if the application has reached its expiration date.
 * Tries multiple time APIs. Fails closed if all unreachable.
 */

export const checkExpirationStatus = async (): Promise<{ isExpired: boolean; message?: string }> => {
    const EXPIRY_DATE_ISO = '2026-03-18';
    const EXPIRY_DATE_LONG = '2026-03-18T00:00:00Z';

    console.log('[Security] Initiating expiration check...');

    const apis = [
        'https://worldtimeapi.org/api/timezone/Etc/UTC',
        'https://timeapi.io/api/Time/current/zone?timeZone=UTC',
    ];

    for (const url of apis) {
        try {
            console.log(`[Security] Trying ${url}...`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) continue;

            const data = await response.json();
            const dateStr = data.datetime || data.dateTime || data.utc_datetime;
            if (!dateStr) continue;

            const currentDate = new Date(dateStr);
            const expirationDate = new Date(EXPIRY_DATE_LONG);

            console.log('[Security] Current Date (API):', currentDate.toISOString());

            if (currentDate >= expirationDate) {
                return {
                    isExpired: true,
                    message: `This version has expired (Deadline: ${EXPIRY_DATE_ISO}). Contact Samrat for an update.`,
                };
            }

            return { isExpired: false };
        } catch (err) {
            console.warn(`[Security] Failed: ${url}`, err);
            continue;
        }
    }

    // Strict: no network access = deny
    console.error('[Security] All time servers unreachable.');
    return {
        isExpired: true,
        message: 'Network Error: Internet connection required to verify access. Please check your connection.',
    };
};
