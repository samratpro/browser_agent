import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

// ─── Schema SQL ──────────────────────────────────────────────

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL DEFAULT 'user',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  domain           TEXT NOT NULL,
  prompt           TEXT NOT NULL,
  intent           TEXT,
  state            TEXT NOT NULL DEFAULT 'IDLE',
  progress         INTEGER NOT NULL DEFAULT 0,
  pattern_id       TEXT,
  execution_graph  TEXT,
  extracted_data   TEXT,
  error_message    TEXT,
  schedule_id      TEXT,
  started_at       INTEGER,
  completed_at     INTEGER,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS patterns (
  id              TEXT PRIMARY KEY,
  domain          TEXT NOT NULL,
  intent          TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  selector_map    TEXT NOT NULL,
  actions         TEXT NOT NULL,
  success_count   INTEGER NOT NULL DEFAULT 0,
  failure_count   INTEGER NOT NULL DEFAULT 0,
  success_rate    REAL NOT NULL DEFAULT 0,
  is_disabled     INTEGER NOT NULL DEFAULT 0,
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pattern_versions (
  id          TEXT PRIMARY KEY,
  pattern_id  TEXT NOT NULL,
  version     INTEGER NOT NULL,
  selector_map TEXT NOT NULL,
  actions     TEXT NOT NULL,
  change_note TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_graphs (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL,
  graph_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  pattern_id      TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  is_enabled      INTEGER NOT NULL DEFAULT 1,
  last_run_at     INTEGER,
  next_run_at     INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_runs (
  id          TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  task_id     TEXT NOT NULL,
  status      TEXT NOT NULL,
  started_at  INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE TABLE IF NOT EXISTS logs (
  id        TEXT PRIMARY KEY,
  task_id   TEXT NOT NULL,
  level     TEXT NOT NULL,
  message   TEXT NOT NULL,
  context   TEXT,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS credentials (
  id         TEXT PRIMARY KEY,
  domain     TEXT NOT NULL,
  label      TEXT NOT NULL,
  username   TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS kv_store (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_state     ON tasks(state);
CREATE INDEX IF NOT EXISTS idx_tasks_domain    ON tasks(domain);
CREATE INDEX IF NOT EXISTS idx_logs_task_id    ON logs(task_id);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp  ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_patterns_domain ON patterns(domain);
CREATE INDEX IF NOT EXISTS idx_pv_pattern_id   ON pattern_versions(pattern_id);
`;

// ─── Singleton ────────────────────────────────────────────────

let _SQL: SqlJsStatic | null = null;
let _db: Database | null = null;
let _dbPath: string | null = null;

async function initDb(): Promise<Database> {
  if (_db) return _db;

  // sql.js WASM file ships inside the package
  const wasmPath = path.join(
    app.getAppPath(),
    'node_modules/sql.js/dist/sql-wasm.wasm',
  );

  _SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });

  _dbPath = path.join(app.getPath('userData'), 'agent.db');

  if (fs.existsSync(_dbPath)) {
    const fileBuffer = fs.readFileSync(_dbPath);
    _db = new _SQL.Database(fileBuffer);
  } else {
    _db = new _SQL.Database();
  }

  _db.run(SCHEMA_SQL);
  _persist();
  return _db;
}

/** Write db to disk (called after every write). */
function _persist(): void {
  if (!_db || !_dbPath) return;
  const data = _db.export();
  fs.writeFileSync(_dbPath, Buffer.from(data));
}

// ─── DatabaseService ─────────────────────────────────────────

export class DatabaseService {
  private db!: Database;

  constructor() {
    // Synchronous init is not possible with sql.js — we rely on
    // the static ensureReady() being called first from main.ts
    if (!_db) throw new Error('DatabaseService used before ensureReady()');
    this.db = _db;
  }

  // ── Generic helpers ──────────────────────────────────────

  run(sql: string, params: unknown[] = []): void {
    this.db.run(sql, params as (string | number | null | Uint8Array)[]);
    _persist();
  }

  get<T>(sql: string, params: unknown[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    stmt.bind(params as (string | number | null | Uint8Array)[]);
    if (!stmt.step()) { stmt.free(); return undefined; }
    const row = stmt.getAsObject() as T;
    stmt.free();
    return row;
  }

  all<T>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    stmt.bind(params as (string | number | null | Uint8Array)[]);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
  }

  transaction<T>(fn: () => T): T {
    this.db.run('BEGIN');
    try {
      const result = fn();
      this.db.run('COMMIT');
      _persist();
      return result;
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
  }

  // ── Key-Value Store ──────────────────────────────────────

  kvGet(key: string): string | null {
    const row = this.get<{ value: string }>('SELECT value FROM kv_store WHERE key = ?', [key]);
    return row?.value ?? null;
  }

  kvSet(key: string, value: string | null): void {
    if (value === null) {
      this.run('DELETE FROM kv_store WHERE key = ?', [key]);
    } else {
      this.run('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)', [key, value]);
    }
  }

  // ── Port Management ──────────────────────────────────────

  getNextDebugPort(): number {
    const KEY = 'last_debug_port';
    const firstPort = 9100; // Lower start so 9222+ are safe
    const lastPortVal = this.kvGet(KEY);
    const current = lastPortVal ? parseInt(lastPortVal) : firstPort;
    const next = current + 1;
    this.kvSet(KEY, next.toString());
    return next;
  }
}

// ─── Module-level init helpers ────────────────────────────────

/** Must be called (awaited) before creating any DatabaseService instance. */
export async function ensureReady(): Promise<void> {
  await initDb();
}

/** @deprecated - renamed to ensureReady */
export async function ensureKVTable(): Promise<void> {
  await ensureReady();
}

export function getDatabase(): Database {
  if (!_db) throw new Error('DB not initialised');
  return _db;
}
