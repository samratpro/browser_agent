import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task, AgentState } from '../../../shared/types/AgentTypes';

function getStateBadgeClass(state: AgentState): string {
    const map: Record<string, string> = {
        [AgentState.IDLE]: 'badge-idle',
        [AgentState.PLANNING]: 'badge-planning',
        [AgentState.EXPLORING]: 'badge-planning',
        [AgentState.LEARNING]: 'badge-planning',
        [AgentState.EXECUTING]: 'badge-running',
        [AgentState.STUCK]: 'badge-failed',
        [AgentState.WAITING_USER]: 'badge-waiting',
        [AgentState.PAUSED]: 'badge-paused',
        [AgentState.COMPLETED]: 'badge-success',
        [AgentState.FAILED]: 'badge-failed',
    };
    return map[state] ?? 'badge-idle';
}

function formatDate(ts?: number): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

export default function TasksPage() {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [prompt, setPrompt] = useState('');
    const [url, setUrl] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [twoFA, setTwoFA] = useState('');
    const [showOptional, setShowOptional] = useState(false);
    const [isSchedule, setIsSchedule] = useState(false);
    const [running, setRunning] = useState(false);
    const promptRef = useRef<HTMLTextAreaElement>(null);

    const loadTasks = async () => {
        try {
            const data = await window.electronAPI.getTasks();
            setTasks(data as Task[]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
        const interval = setInterval(loadTasks, 3000);
        const unsub = window.electronAPI.onTaskUpdate(() => loadTasks());
        return () => { clearInterval(interval); unsub(); };
    }, []);

    const handleRunTask = async () => {
        if (!prompt.trim()) { promptRef.current?.focus(); return; }
        setRunning(true);
        try {
            await window.electronAPI.runTask({ prompt, url, email, password, twoFactorCode: twoFA });
            setPrompt(''); setUrl(''); setEmail(''); setPassword(''); setTwoFA('');
            await loadTasks();
        } catch (e) {
            console.error(e);
        } finally {
            setRunning(false);
        }
    };

    const handleAction = async (taskId: string, action: 'pause' | 'resume' | 'stop' | 'delete') => {
        const api = {
            pause: () => window.electronAPI.pauseTask(taskId),
            resume: () => window.electronAPI.resumeTask(taskId),
            stop: () => window.electronAPI.stopTask(taskId),
            delete: () => window.electronAPI.deleteTask(taskId),
        };
        await api[action]();
        await loadTasks();
    };

    const isActive = (state: AgentState) =>
        [AgentState.PLANNING, AgentState.EXPLORING, AgentState.LEARNING, AgentState.EXECUTING].includes(state);

    const isPaused = (state: AgentState) =>
        state === AgentState.PAUSED || state === AgentState.WAITING_USER;

    return (
        <div className="page animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Tasks</h1>
                <p className="page-subtitle">Create and manage your automation tasks</p>
            </div>

            {/* ── Task Input Card ── */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="form-group">
                    <label className="form-label">What do you want to automate?</label>
                    <textarea
                        ref={promptRef}
                        className="form-textarea prompt-textarea"
                        placeholder='e.g. "Scrape all product names and prices from amazon.com/s?q=laptop and save to CSV"'
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={4}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Target URL (optional)</label>
                    <input
                        type="url"
                        className="form-input"
                        placeholder="https://example.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                    />
                </div>

                {/* Optional fields toggle */}
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginBottom: 12 }}
                    onClick={() => setShowOptional((v) => !v)}
                >
                    {showOptional ? '▲' : '▼'} {showOptional ? 'Hide' : 'Show'} login fields
                </button>

                {showOptional && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Email</label>
                            <input className="form-input" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Password</label>
                            <input type="password" className="form-input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">2FA Code</label>
                            <input className="form-input" placeholder="123456" value={twoFA} onChange={(e) => setTwoFA(e.target.value)} />
                        </div>
                    </div>
                )}

                <div className="btn-row">
                    <button className="btn btn-primary" onClick={handleRunTask} disabled={running || !prompt.trim()}>
                        {running ? <><span className="spinner" /> Running...</> : '▶ Run Task'}
                    </button>
                    <label className="toggle">
                        <input type="checkbox" checked={isSchedule} onChange={(e) => setIsSchedule(e.target.checked)} />
                        <div className="toggle-track"><div className="toggle-thumb" /></div>
                        <span className="toggle-label">Schedule Instead</span>
                    </label>
                </div>
            </div>

            {/* ── Task Table ── */}
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Task Name</th>
                            <th>Domain</th>
                            <th>Status</th>
                            <th>Progress</th>
                            <th>Started</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>
                                <div className="spinner" style={{ margin: '0 auto' }} />
                            </td></tr>
                        )}
                        {!loading && !tasks.length && (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                                No tasks yet. Run your first task above!
                            </td></tr>
                        )}
                        {tasks.map((task) => (
                            <tr key={task.id}>
                                <td>
                                    <div style={{ fontWeight: 500, maxWidth: 240 }} className="truncate">{task.name}</div>
                                    {task.intent && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{task.intent}</div>}
                                </td>
                                <td>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{task.domain}</span>
                                </td>
                                <td>
                                    <span className={`badge ${getStateBadgeClass(task.state)}`}>{task.state}</span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div className="progress-bar">
                                            <div className="progress-fill" style={{ width: `${task.progress}%` }} />
                                        </div>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 28 }}>{task.progress}%</span>
                                    </div>
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    {formatDate(task.startedAt)}
                                </td>
                                <td>
                                    <div className="btn-row">
                                        <button className="btn btn-secondary btn-xs" onClick={() => navigate(`/tasks/${task.id}`)}>
                                            View
                                        </button>
                                        {isActive(task.state) && (
                                            <button className="btn btn-warning btn-xs" onClick={() => handleAction(task.id, 'pause')}>
                                                Pause
                                            </button>
                                        )}
                                        {isPaused(task.state) && (
                                            <button className="btn btn-secondary btn-xs" onClick={() => handleAction(task.id, 'resume')}
                                                style={{ color: 'var(--success)' }}>
                                                Resume
                                            </button>
                                        )}
                                        {(isActive(task.state) || isPaused(task.state)) && (
                                            <button className="btn btn-danger btn-xs" onClick={() => handleAction(task.id, 'stop')}>
                                                Stop
                                            </button>
                                        )}
                                        {(task.state === AgentState.COMPLETED || task.state === AgentState.FAILED || task.state === AgentState.IDLE) && (
                                            <button className="btn btn-danger btn-xs" onClick={() => handleAction(task.id, 'delete')}>
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
