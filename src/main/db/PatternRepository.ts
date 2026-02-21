import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from './DatabaseService';
import {
    Pattern,
    PatternVersion,
    SelectorMap,
    Action,
    TaskIntent,
} from '../../shared/types/AgentTypes';

interface PatternRow {
    id: string;
    domain: string;
    intent: string;
    name: string;
    description: string | null;
    selector_map: string;
    actions: string;
    success_count: number;
    failure_count: number;
    success_rate: number;
    is_disabled: number;
    current_version: number;
    created_at: number;
    updated_at: number;
}

interface PatternVersionRow {
    id: string;
    pattern_id: string;
    version: number;
    selector_map: string;
    actions: string;
    change_note: string | null;
    created_at: number;
}

function rowToPattern(row: PatternRow): Pattern {
    return {
        id: row.id,
        domain: row.domain,
        intent: row.intent as TaskIntent,
        name: row.name,
        description: row.description ?? undefined,
        selectorMap: JSON.parse(row.selector_map),
        actions: JSON.parse(row.actions),
        successCount: row.success_count,
        failureCount: row.failure_count,
        successRate: row.success_rate,
        isDisabled: row.is_disabled === 1,
        currentVersion: row.current_version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function rowToVersion(row: PatternVersionRow): PatternVersion {
    return {
        id: row.id,
        patternId: row.pattern_id,
        version: row.version,
        selectorMap: JSON.parse(row.selector_map),
        actions: JSON.parse(row.actions),
        changeNote: row.change_note ?? undefined,
        createdAt: row.created_at,
    };
}

export class PatternRepository {
    constructor(private db: DatabaseService) { }

    // ── CRUD ───────────────────────────────────────────────────

    create(
        domain: string,
        intent: TaskIntent,
        name: string,
        selectorMap: SelectorMap,
        actions: Action[],
        description?: string,
    ): Pattern {
        const id = uuidv4();
        const now = Date.now();
        this.db.run(
            `INSERT INTO patterns (id,domain,intent,name,description,selector_map,actions,
        success_count,failure_count,success_rate,is_disabled,current_version,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,0,0,0,0,1,?,?)`,
            [id, domain, intent, name, description ?? null, JSON.stringify(selectorMap), JSON.stringify(actions), now, now],
        );
        this.saveVersion(id, 1, selectorMap, actions, 'Initial version');
        return this.getById(id)!;
    }

    getById(id: string): Pattern | undefined {
        const row = this.db.get<PatternRow>('SELECT * FROM patterns WHERE id = ?', [id]);
        return row ? rowToPattern(row) : undefined;
    }

    getByDomainAndIntent(domain: string, intent: TaskIntent): Pattern | undefined {
        const row = this.db.get<PatternRow>(
            'SELECT * FROM patterns WHERE domain = ? AND intent = ? AND is_disabled = 0 ORDER BY success_rate DESC LIMIT 1',
            [domain, intent],
        );
        return row ? rowToPattern(row) : undefined;
    }

    getAll(): Pattern[] {
        const rows = this.db.all<PatternRow>('SELECT * FROM patterns ORDER BY updated_at DESC');
        return rows.map(rowToPattern);
    }

    update(
        id: string,
        selectorMap: SelectorMap,
        actions: Action[],
        changeNote?: string,
    ): Pattern | undefined {
        const existing = this.getById(id);
        if (!existing) return undefined;

        const newVersion = existing.currentVersion + 1;
        const now = Date.now();

        this.db.run(
            `UPDATE patterns SET selector_map = ?, actions = ?, current_version = ?, updated_at = ? WHERE id = ?`,
            [JSON.stringify(selectorMap), JSON.stringify(actions), newVersion, now, id],
        );
        this.saveVersion(id, newVersion, selectorMap, actions, changeNote);
        return this.getById(id);
    }

    recordSuccess(id: string): void {
        this.db.run(
            `UPDATE patterns SET
        success_count = success_count + 1,
        success_rate = CAST(success_count + 1 AS REAL) / (success_count + failure_count + 1),
        updated_at = ?
       WHERE id = ?`,
            [Date.now(), id],
        );
    }

    recordFailure(id: string): void {
        this.db.run(
            `UPDATE patterns SET
        failure_count = failure_count + 1,
        success_rate = CAST(success_count AS REAL) / (success_count + failure_count + 1),
        updated_at = ?
       WHERE id = ?`,
            [Date.now(), id],
        );
    }

    setDisabled(id: string, disabled: boolean): void {
        this.db.run('UPDATE patterns SET is_disabled = ?, updated_at = ? WHERE id = ?', [
            disabled ? 1 : 0,
            Date.now(),
            id,
        ]);
    }

    delete(id: string): void {
        this.db.run('DELETE FROM patterns WHERE id = ?', [id]);
    }

    // ── Version History ────────────────────────────────────────

    private saveVersion(
        patternId: string,
        version: number,
        selectorMap: SelectorMap,
        actions: Action[],
        changeNote?: string,
    ): void {
        this.db.run(
            `INSERT INTO pattern_versions (id,pattern_id,version,selector_map,actions,change_note,created_at)
       VALUES (?,?,?,?,?,?,?)`,
            [uuidv4(), patternId, version, JSON.stringify(selectorMap), JSON.stringify(actions), changeNote ?? null, Date.now()],
        );
    }

    getVersions(patternId: string): PatternVersion[] {
        const rows = this.db.all<PatternVersionRow>(
            'SELECT * FROM pattern_versions WHERE pattern_id = ? ORDER BY version DESC',
            [patternId],
        );
        return rows.map(rowToVersion);
    }

    getVersion(patternId: string, version: number): PatternVersion | undefined {
        const row = this.db.get<PatternVersionRow>(
            'SELECT * FROM pattern_versions WHERE pattern_id = ? AND version = ?',
            [patternId, version],
        );
        return row ? rowToVersion(row) : undefined;
    }
}
