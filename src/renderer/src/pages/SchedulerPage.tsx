import { useEffect, useState } from 'react';
import { Pattern, Schedule } from '../../../shared/types/AgentTypes';

interface ScheduleRow extends Schedule {
    pattern_name?: string;
    domain?: string;
}

interface ScheduleRun {
    id: string;
    scheduleId: string;
    taskId: string;
    status: 'success' | 'failed' | 'running';
    startedAt: number;
    finishedAt?: number;
}

function formatDate(ts?: number): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

export default function SchedulerPage() {
    const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
    const [patterns, setPatterns] = useState<Pattern[]>([]);
    const [runs, setRuns] = useState<ScheduleRun[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Form state
    const [name, setName] = useState('');
    const [patternId, setPatternId] = useState('');
    const [cron, setCron] = useState('0 9 * * 1-5');
    const [creating, setCreating] = useState(false);

    const load = async () => {
        try {
            const [s, p] = await Promise.all([
                window.electronAPI.getSchedules(),
                window.electronAPI.getPatterns(),
            ]);
            setSchedules(s as ScheduleRow[]);
            setPatterns(p as Pattern[]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const viewRuns = async (scheduleId: string) => {
        setSelectedId(scheduleId === selectedId ? null : scheduleId);
        if (scheduleId !== selectedId) {
            const r = await window.electronAPI.getScheduleRuns(scheduleId);
            setRuns(r as ScheduleRun[]);
        }
    };

    const handleCreate = async () => {
        if (!name.trim() || !patternId || !cron.trim()) return;
        setCreating(true);
        try {
            await window.electronAPI.createSchedule({ name, patternId, cronExpression: cron });
            setName(''); setPatternId(''); setCron('0 9 * * 1-5');
            await load();
        } finally {
            setCreating(false);
        }
    };

    const handleToggle = async (id: string, enabled: boolean) => {
        await window.electronAPI.toggleSchedule(id, !enabled);
        await load();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this schedule?')) return;
        await window.electronAPI.deleteSchedule(id);
        await load();
    };

    const CRON_PRESETS = [
        { label: 'Every day at 9am', value: '0 9 * * *' },
        { label: 'Weekdays at 9am', value: '0 9 * * 1-5' },
        { label: 'Every hour', value: '0 * * * *' },
        { label: 'Every 30 minutes', value: '*/30 * * * *' },
        { label: 'Every Monday 8am', value: '0 8 * * 1' },
    ];

    return (
        <div className="page animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Scheduler</h1>
                <p className="page-subtitle">Automate recurring tasks with cron schedules</p>
            </div>

            {/* Create Schedule Card */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Create Schedule</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Schedule Name</label>
                        <input className="form-input" placeholder="Daily Price Monitor" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Pattern</label>
                        <select className="form-select" value={patternId} onChange={(e) => setPatternId(e.target.value)}>
                            <option value="">Select a pattern...</option>
                            {patterns.filter((p) => !p.isDisabled).map((p) => (
                                <option key={p.id} value={p.id}>{p.name} ({p.domain})</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Cron Expression</label>
                        <input className="form-input" placeholder="0 9 * * *" value={cron} onChange={(e) => setCron(e.target.value)}
                            style={{ fontFamily: 'var(--font-mono)' }} />
                    </div>
                </div>

                {/* Cron presets */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, marginBottom: 12 }}>
                    {CRON_PRESETS.map((p) => (
                        <button key={p.value} className="btn btn-secondary btn-xs" onClick={() => setCron(p.value)}>
                            {p.label}
                        </button>
                    ))}
                </div>

                <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !name.trim() || !patternId || !cron.trim()}>
                    {creating ? <><span className="spinner" /> Creating...</> : '+ Create Schedule'}
                </button>
            </div>

            {/* Schedule Table */}
            <div className="table-wrapper" style={{ marginBottom: 24 }}>
                <table>
                    <thead>
                        <tr>
                            <th>Schedule</th>
                            <th>Pattern</th>
                            <th>Cron</th>
                            <th>Status</th>
                            <th>Last Run</th>
                            <th>Next Run</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>}
                        {!loading && !schedules.length && (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No schedules yet.</td></tr>
                        )}
                        {schedules.map((s) => (
                            <tr key={s.id}>
                                <td style={{ fontWeight: 500 }}>{s.name}</td>
                                <td>
                                    <div style={{ fontSize: 12 }}>{s.pattern_name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.domain}</div>
                                </td>
                                <td><code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.cronExpression}</code></td>
                                <td>
                                    <span className={`badge ${s.isEnabled ? 'badge-success' : 'badge-idle'}`}>
                                        {s.isEnabled ? 'Active' : 'Paused'}
                                    </span>
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(s.lastRunAt)}</td>
                                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(s.nextRunAt)}</td>
                                <td>
                                    <div className="btn-row">
                                        <button className="btn btn-secondary btn-xs" onClick={() => viewRuns(s.id)}>Runs</button>
                                        <button
                                            className={`btn btn-${s.isEnabled ? 'warning' : 'secondary'} btn-xs`}
                                            onClick={() => handleToggle(s.id, s.isEnabled)}
                                            style={{ color: s.isEnabled ? undefined : 'var(--success)' }}
                                        >
                                            {s.isEnabled ? 'Pause' : 'Enable'}
                                        </button>
                                        <button className="btn btn-danger btn-xs" onClick={() => handleDelete(s.id)}>✕</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Past Runs */}
            {selectedId && (
                <div className="card">
                    <div className="card-title" style={{ marginBottom: 12 }}>
                        Past Runs — {schedules.find((s) => s.id === selectedId)?.name}
                    </div>
                    {!runs.length ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>No runs yet.</div>
                    ) : (
                        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                            <table>
                                <thead><tr><th>Status</th><th>Started</th><th>Finished</th><th>Duration</th></tr></thead>
                                <tbody>
                                    {runs.map((r) => (
                                        <tr key={r.id}>
                                            <td>
                                                <span className={`badge ${r.status === 'success' ? 'badge-success' : r.status === 'running' ? 'badge-running' : 'badge-failed'}`}>
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 12 }}>{formatDate(r.startedAt)}</td>
                                            <td style={{ fontSize: 12 }}>{r.finishedAt ? formatDate(r.finishedAt) : '—'}</td>
                                            <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                                {r.finishedAt ? `${Math.round((r.finishedAt - r.startedAt) / 1000)}s` : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
