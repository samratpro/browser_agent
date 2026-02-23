import { useEffect, useState } from 'react';
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

export default function RunningTasksPage() {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    const loadTasks = async () => {
        try {
            const allTasks = await window.electronAPI.getTasks() as Task[];
            const activeTasks = allTasks.filter(t =>
                [AgentState.PLANNING, AgentState.EXPLORING, AgentState.LEARNING, AgentState.EXECUTING, AgentState.WAITING_USER, AgentState.PAUSED].includes(t.state)
            );
            setTasks(activeTasks);
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

    const handleAction = async (taskId: string, action: 'pause' | 'resume' | 'stop') => {
        const api = {
            pause: () => window.electronAPI.pauseTask(taskId),
            resume: () => window.electronAPI.resumeTask(taskId),
            stop: () => window.electronAPI.stopTask(taskId),
        };
        await api[action]();
        await loadTasks();
    };

    return (
        <div className="page animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Running Tasks</h1>
                <p className="page-subtitle">Monitor and control your active automation tasks</p>
            </div>

            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Task Name</th>
                            <th>Status</th>
                            <th>Progress</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32 }}>
                                <div className="spinner" style={{ margin: '0 auto' }} />
                            </td></tr>
                        )}
                        {!loading && !tasks.length && (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                                No active tasks running.
                            </td></tr>
                        )}
                        {tasks.map((task) => (
                            <tr key={task.id}>
                                <td>
                                    <div style={{ fontWeight: 500 }}>{task.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{task.domain}</div>
                                </td>
                                <td>
                                    <span className={`badge ${getStateBadgeClass(task.state)}`}>{task.state}</span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div className="progress-bar">
                                            <div className="progress-fill" style={{ width: `${task.progress}%` }} />
                                        </div>
                                        <span style={{ fontSize: 11 }}>{task.progress}%</span>
                                    </div>
                                </td>
                                <td>
                                    <div className="btn-row">
                                        <button className="btn btn-secondary btn-xs" onClick={() => navigate(`/tasks/${task.id}`)}>View</button>
                                        {[AgentState.PLANNING, AgentState.EXPLORING, AgentState.LEARNING, AgentState.EXECUTING].includes(task.state) ? (
                                            <button className="btn btn-warning btn-xs" onClick={() => handleAction(task.id, 'pause')}>Pause</button>
                                        ) : (
                                            <button className="btn btn-secondary btn-xs" onClick={() => handleAction(task.id, 'resume')} style={{ color: 'var(--success)' }}>Resume</button>
                                        )}
                                        <button className="btn btn-danger btn-xs" onClick={() => handleAction(task.id, 'stop')}>Stop</button>
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
