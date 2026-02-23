import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task, AgentState } from '../../../shared/types/AgentTypes';
import BrowserSetupModal from '../components/BrowserSetupModal';

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
                <h1 className="page-title">Train Task List</h1>
                <p className="page-subtitle">View and manage all recorded tasks</p>
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