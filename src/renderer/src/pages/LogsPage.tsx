import { useEffect, useState, useRef } from 'react';
import { LogEntry, LogLevel } from '../../../shared/types/AgentTypes';

function formatTs(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

export default function LogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [level, setLevel] = useState<LogLevel | 'all'>('all');
    const [taskFilter, setTaskFilter] = useState('all');
    const [tasks, setTasks] = useState<{ id: string; name: string }[]>([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const endRef = useRef<HTMLDivElement>(null);

    const loadLogs = async () => {
        try {
            // Get all tasks and their logs
            const allTasks = (await window.electronAPI.getTasks()) as { id: string; name: string }[];
            setTasks(allTasks);

            const selectedTask = taskFilter === 'all' ? allTasks[0]?.id : taskFilter;
            if (selectedTask) {
                const data = (await window.electronAPI.getTaskLogs(selectedTask)) as LogEntry[];
                setLogs(data);
            } else {
                setLogs([]);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadLogs(); }, [taskFilter]);

    // Live log stream
    useEffect(() => {
        const unsub = window.electronAPI.onTaskLogLine((e: { taskId: string; entry: LogEntry }) => {
            if (taskFilter === 'all' || e.taskId === taskFilter) {
                setLogs((prev) => [...prev, e.entry].slice(-1000));
                if (autoScroll) {
                    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                }
            }
        });
        return unsub;
    }, [taskFilter, autoScroll]);

    useEffect(() => {
        if (autoScroll) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    const filtered = logs.filter((l) => {
        if (level !== 'all' && l.level !== level) return false;
        if (filter && !l.message.toLowerCase().includes(filter.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="page animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Logs</h1>
                <p className="page-subtitle">Search and filter execution logs</p>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 10, alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Search</label>
                        <input className="form-input" placeholder="Filter log messages..." value={filter} onChange={(e) => setFilter(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, minWidth: 120 }}>
                        <label className="form-label">Task</label>
                        <select className="form-select" value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)}>
                            <option value="all">All Tasks</option>
                            {tasks.map((t) => (
                                <option key={t.id} value={t.id}>{t.name.slice(0, 30)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, minWidth: 100 }}>
                        <label className="form-label">Level</label>
                        <select className="form-select" value={level} onChange={(e) => setLevel(e.target.value as LogLevel | 'all')}>
                            <option value="all">All</option>
                            {LEVELS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Auto-scroll</label>
                        <label className="toggle" style={{ paddingTop: 10 }}>
                            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
                            <div className="toggle-track"><div className="toggle-thumb" /></div>
                        </label>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ opacity: 0 }}>.</label>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setFilter(''); setLevel('all'); }}>↺ Clear</button>
                    </div>
                </div>
            </div>

            {/* Log Stats */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                {LEVELS.map((l) => {
                    const count = logs.filter((x) => x.level === l).length;
                    return (
                        <div key={l} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: l === 'info' ? 'var(--info)' : l === 'warn' ? 'var(--warning)' : l === 'error' ? 'var(--danger)' : 'var(--text-muted)' }} />
                            <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{l}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{count}</span>
                        </div>
                    );
                })}
                <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                    {filtered.length} / {logs.length} entries
                </div>
            </div>

            {/* Log Viewer */}
            <div className="log-viewer" style={{ maxHeight: 'calc(100vh - 380px)', flex: 1 }}>
                {loading && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Loading...</div>}
                {!loading && !filtered.length && (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                        {logs.length ? 'No entries match your filters.' : 'No logs yet. Run a task to generate logs.'}
                    </div>
                )}
                {filtered.map((l) => (
                    <div key={l.id} className={`log-line ${l.level}`}>
                        <span className="log-time">{formatTs(l.timestamp)}</span>
                        <span className="log-level">{l.level.toUpperCase()}</span>
                        <span className="log-msg">{l.message}</span>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
        </div>
    );
}
