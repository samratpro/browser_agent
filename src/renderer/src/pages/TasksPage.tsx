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
    const [prompt, setPrompt] = useState('');
    const [url, setUrl] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [twoFA, setTwoFA] = useState('');
    const [showOptional, setShowOptional] = useState(false);
    const [isSchedule, setIsSchedule] = useState(false);
    const [running, setRunning] = useState(false);

    // Browser config
    const [showBrowserConfig, setShowBrowserConfig] = useState(false);
    const [browserType, setBrowserType] = useState('chromium');
    const [headless, setHeadless] = useState(false);
    const [profileName, setProfileName] = useState('');
    const [useProxy, setUseProxy] = useState(false);
    const [proxyServer, setProxyServer] = useState('');
    const [proxyUser, setProxyUser] = useState('');
    const [proxyPass, setProxyPass] = useState('');
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [resourceFolder, setResourceFolder] = useState('');

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
            const browserConfig = showBrowserConfig ? {
                browserType,
                headless,
                profileName: profileName.trim() || undefined,
                proxy: useProxy && proxyServer.trim() ? {
                    server: proxyServer.trim(),
                    username: proxyUser.trim() || undefined,
                    password: proxyPass.trim() || undefined,
                } : undefined,
            } : undefined;
            await window.electronAPI.runTask({
                prompt, url, email, password, twoFactorCode: twoFA,
                browserConfig,
                resourceFolder: resourceFolder.trim() || undefined,
            });
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

                {/* Login fields toggle */}
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginBottom: 12 }}
                    onClick={() => setShowOptional((v) => !v)}
                >
                    {showOptional ? '▲ Hide' : '▼ Show'} login fields
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

                {/* Browser Config toggle */}
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginBottom: 12 }}
                    onClick={() => setShowBrowserConfig((v) => !v)}
                >
                    {showBrowserConfig ? '▲ Hide' : '⚙ Browser Config'}
                </button>

                {showBrowserConfig && (
                    <div style={{
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                        padding: 16, marginBottom: 14, background: 'var(--bg-elevated)',
                    }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            {/* Browser Type */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Browser</label>
                                <select
                                    className="form-select"
                                    value={browserType}
                                    onChange={(e) => setBrowserType(e.target.value)}
                                >
                                    <option value="chromium">Chromium (built-in)</option>
                                    <option value="chrome">Google Chrome</option>
                                    <option value="edge">Microsoft Edge</option>
                                    <option value="brave">Brave</option>
                                    <option value="comet">Comet</option>
                                </select>
                            </div>
                            {/* Profile Name */}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Profile Name (optional)</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. default, work, personal"
                                    value={profileName}
                                    onChange={(e) => setProfileName(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Headless + Proxy toggles */}
                        <div style={{ display: 'flex', gap: 20, marginBottom: 12, flexWrap: 'wrap' }}>
                            <label className="toggle">
                                <input type="checkbox" checked={headless} onChange={(e) => setHeadless(e.target.checked)} />
                                <div className="toggle-track"><div className="toggle-thumb" /></div>
                                <span className="toggle-label">Headless Mode</span>
                            </label>
                            <label className="toggle">
                                <input type="checkbox" checked={useProxy} onChange={(e) => setUseProxy(e.target.checked)} />
                                <div className="toggle-track"><div className="toggle-thumb" /></div>
                                <span className="toggle-label">Use Proxy</span>
                            </label>
                        </div>

                        {/* Proxy fields */}
                        {useProxy && (
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Proxy Server</label>
                                    <input
                                        className="form-input"
                                        placeholder="http://proxy.example.com:8080"
                                        value={proxyServer}
                                        onChange={(e) => setProxyServer(e.target.value)}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Username</label>
                                    <input className="form-input" placeholder="username" value={proxyUser} onChange={(e) => setProxyUser(e.target.value)} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Password</label>
                                    <input type="password" className="form-input" placeholder="••••••••" value={proxyPass} onChange={(e) => setProxyPass(e.target.value)} />
                                </div>
                            </div>
                        )}

                        {/* Browser Setup divider */}
                        <div style={{
                            paddingTop: 12, borderTop: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                        }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Log in or configure the browser manually before running.
                            </span>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ flexShrink: 0 }}
                                onClick={() => setShowSetupModal(true)}
                            >
                                🌐 Open Browser for Setup
                            </button>
                        </div>
                    </div>
                )}

                {/* Resource Folder */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">Resource Folder (optional)</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            className="form-input"
                            placeholder="Folder for input files and task output..."
                            value={resourceFolder}
                            onChange={(e) => setResourceFolder(e.target.value)}
                            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                        />
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ flexShrink: 0 }}
                            onClick={async () => {
                                const dir = await window.electronAPI.openFolderDialog(resourceFolder || undefined);
                                if (dir) setResourceFolder(dir);
                            }}
                        >
                            Browse...
                        </button>
                        {resourceFolder && (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setResourceFolder('')}>✕</button>
                        )}
                    </div>
                    {resourceFolder && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                            {resourceFolder}
                        </div>
                    )}
                </div>

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

            {/* Browser Profile Setup Modal */}
            {showSetupModal && (
                <BrowserSetupModal
                    defaultProfileName={profileName}
                    defaultUrl={url}
                    onClose={() => setShowSetupModal(false)}
                    onProfileSaved={(name) => { setProfileName(name); }}
                />
            )}
        </div>
    );
}