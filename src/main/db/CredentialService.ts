import { app, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// ─── CredentialService ────────────────────────────────────────
// Replaces keytar with electron.safeStorage (OS-level encryption,
// zero native module compilation required).
//
// Passwords are stored in a JSON file encrypted with safeStorage.
// API key is stored the same way.

const STORE_FILE = () => path.join(app.getPath('userData'), 'credentials.enc');

interface CredStore {
    [id: string]: string; // id → encrypted-base64 password
}

function loadStore(): CredStore {
    try {
        const raw = fs.readFileSync(STORE_FILE(), 'utf-8');
        return JSON.parse(raw) as CredStore;
    } catch {
        return {};
    }
}

function saveStore(store: CredStore): void {
    fs.writeFileSync(STORE_FILE(), JSON.stringify(store), 'utf-8');
}

function encrypt(plaintext: string): string {
    if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.encryptString(plaintext).toString('base64');
    }
    // Fallback: AES-256-GCM with a machine-local key derived from app path
    const key = crypto.scryptSync(app.getPath('userData'), 'salt-ai-agent', 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(ciphertext: string): string {
    if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(ciphertext, 'base64'));
    }
    // Fallback AES decrypt
    const buf = Buffer.from(ciphertext, 'base64');
    const key = crypto.scryptSync(app.getPath('userData'), 'salt-ai-agent', 32);
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc) + decipher.final('utf8');
}

export class CredentialService {
    // ── Passwords for Website Logins ──────────────────────────

    async setPassword(credentialId: string, password: string): Promise<void> {
        const store = loadStore();
        store[`cred:${credentialId}`] = encrypt(password);
        saveStore(store);
    }

    async getPassword(credentialId: string): Promise<string | null> {
        const store = loadStore();
        const enc = store[`cred:${credentialId}`];
        if (!enc) return null;
        try { return decrypt(enc); } catch { return null; }
    }

    async deletePassword(credentialId: string): Promise<void> {
        const store = loadStore();
        delete store[`cred:${credentialId}`];
        saveStore(store);
    }

    // ── OpenAI API Key ────────────────────────────────────────

    async setApiKey(apiKey: string): Promise<void> {
        const store = loadStore();
        store['openai-api-key'] = encrypt(apiKey);
        saveStore(store);
    }

    async getApiKey(): Promise<string | null> {
        const store = loadStore();
        const enc = store['openai-api-key'];
        if (!enc) return null;
        try { return decrypt(enc); } catch { return null; }
    }
}

// ─── AES field encryption helpers (unchanged API) ─────────────

export function encryptField(plaintext: string, secretKey: string): string {
    const key = crypto.scryptSync(secretKey, 'field-salt', 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptField(ciphertext: string, secretKey: string): string {
    const buf = Buffer.from(ciphertext, 'base64');
    const key = crypto.scryptSync(secretKey, 'field-salt', 32);
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc) + decipher.final('utf8');
}

// ─── Sanitize helpers (used by AIPlanner) ─────────────────────

/** Strip any password/credential fields from an object before sending to AI. */
export function sanitizeForAI(obj: unknown): any {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj;
    }

    const SENSITIVE = ['password', 'secret', 'token', 'apiKey', 'key', 'credential', 'auth', 'twoFactorCode'];
    const result: Record<string, unknown> = {};
    const input = obj as Record<string, unknown>;

    for (const [k, v] of Object.entries(input)) {
        if (SENSITIVE.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
            result[k] = '[REDACTED]';
        } else if (v && typeof v === 'object' && !Array.isArray(v)) {
            result[k] = sanitizeForAI(v);
        } else {
            result[k] = v;
        }
    }
    return result;
}
