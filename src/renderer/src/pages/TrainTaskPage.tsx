import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogEntry, Task } from '../../../shared/types/AgentTypes';

export default function TrainTaskPage() {
    const navigate = useNavigate();
    const [prompt, setPrompt] = useState('');
    const [history, setHistory] = useState<{ role: 'user' | 'system'; text: string }[]>([]);
    const [config, setConfig] = useState({
        url: '',
        email: '',
        password: '',
        twoFactor: '',
        browser: 'chrome',
        profileName: 'default' + Math.random().toString(36).substring(2, 6),
        useProxy: false,
        proxyServer: '',
        proxyUser: '',
        proxyPass: '',
        headless: false,
        profilePath: '',
        resourcePath: '',
    });
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [steps, setSteps] = useState<{ id: string; title: string; status: 'pending' | 'done' | 'active' }[]>([]);
    const [running, setRunning] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        window.electronAPI.getDefaultPaths().then(paths => {
            setConfig(prev => ({
                ...prev,
                profilePath: paths.profiles,
                resourcePath: paths.tasks
            }));
        });
    }, []);

    const handleRun = async () => {
        if (!prompt.trim()) return;
        setRunning(true);
        setHistory(prev => [...prev, { role: 'user', text: prompt }]);
        setHistory(prev => [...prev, { role: 'system', text: 'Working...' }]);

        try {
            const result = await window.electronAPI.runTask({
                prompt,
                url: config.url,
                email: config.email,
                password: config.password,
                twoFactorCode: config.twoFactor,
                browserConfig: {
                    browserType: config.browser,
                    headless: config.headless,
                    profileName: config.profileName,
                    profileBaseDir: config.profilePath,
                    proxy: config.useProxy ? {
                        server: config.proxyServer,
                        username: config.proxyUser,
                        password: config.proxyPass
                    } : undefined
                },
                resourceFolder: config.resourcePath
            }) as { taskId: string };
            if (result?.taskId) {
                navigate(`/tasks/${result.taskId}`);
            }
        } catch (e) {
            setHistory(prev => [...prev, { role: 'system', text: 'Error starting task' }]);
        } finally {
            setRunning(false);
        }
    };

    const handleBrowseFolder = async (field: 'profilePath' | 'resourcePath') => {
        const path = await window.electronAPI.openFolderDialog(config[field]);
        if (path) {
            setConfig(prev => ({ ...prev, [field]: path }));
        }
    };

    const handleOpenBrowserSetup = async () => {
        try {
            await window.electronAPI.setupBrowserProfile(
                config.profileName,
                config.url,
                config.browser,
                config.useProxy ? {
                    server: config.proxyServer,
                    username: config.proxyUser,
                    password: config.proxyPass
                } : undefined,
                config.profilePath
            );
        } catch (e) {
            console.error('Failed to open browser setup', e);
        }
    };

    return (
        <div className="page animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 24px' }}>
            <div className="page-header" style={{ marginBottom: 20 }}>
                <h1 className="page-title">Train A Task</h1>
                <p className="page-subtitle">Teach the agent a new automation pattern with precision</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 40%', gridTemplateRows: '1fr 1fr', gap: 24, flex: 1, minHeight: 0 }}>
                {/* 1. Top Left: Prompt Area + Chat History */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                        <span className="card-title" style={{ fontSize: 13, fontWeight: 700 }}>Task Instruction</span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {history.map((h, i) => (
                            <div key={i} style={{
                                alignSelf: h.role === 'user' ? 'flex-end' : 'flex-start',
                                background: h.role === 'user' ? 'var(--accent)' : 'var(--bg-elevated)',
                                color: h.role === 'user' ? '#fff' : 'var(--text-primary)',
                                padding: '10px 14px',
                                borderRadius: h.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                                maxWidth: '85%',
                                fontSize: 13,
                                boxShadow: 'var(--shadow-sm)',
                                border: h.role === 'system' ? '1px solid var(--border)' : 'none'
                            }}>
                                <div style={{ fontSize: 10, opacity: 0.8, marginBottom: 2, fontWeight: 700 }}>{h.role === 'user' ? 'YOU' : 'AGENT'}</div>
                                {h.text}
                            </div>
                        ))}
                    </div>
                    <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                        <textarea
                            className="form-textarea"
                            placeholder="e.g. 'Go to Amazon, search for iPhone 15, and list the prices...'"
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            rows={3}
                            style={{ resize: 'none', background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 13 }}
                        />
                        <div className="btn-row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" style={{ fontSize: 12 }}>✓ Confirm Step</button>
                            <button className="btn btn-primary" onClick={handleRun} disabled={running} style={{ minWidth: 140 }}>
                                {running ? 'Running...' : '▶ Start Training'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Top Right: Current Config Area */}
                <div className="card" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
                    <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                        <span className="card-title" style={{ fontSize: 13, fontWeight: 700 }}>Execution Parameters</span>
                    </div>

                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Section: Authentication */}
                        <div style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Authentication (Optional)</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ marginBottom: 4, fontSize: 11 }}>Target URL</label>
                                    <input className="form-input" style={{ height: 38, fontSize: 12, background: 'var(--bg-base)' }} placeholder="https://..." value={config.url} onChange={e => setConfig({ ...config, url: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ marginBottom: 4, fontSize: 11 }}>Email / Username</label>
                                    <input className="form-input" style={{ height: 38, fontSize: 12, background: 'var(--bg-base)' }} value={config.email} onChange={e => setConfig({ ...config, email: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ marginBottom: 4, fontSize: 11 }}>Password</label>
                                    <input type="password" className="form-input" style={{ height: 38, fontSize: 12, background: 'var(--bg-base)' }} value={config.password} onChange={e => setConfig({ ...config, password: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ marginBottom: 4, fontSize: 11 }}>2FA Code</label>
                                    <input className="form-input" style={{ height: 38, fontSize: 12, background: 'var(--bg-base)' }} value={config.twoFactor} onChange={e => setConfig({ ...config, twoFactor: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        {/* Section: Environment */}
                        <div style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Browser Environment</div>

                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label" style={{ marginBottom: 6, fontSize: 11, fontWeight: 700 }}>Select Browser Engine</label>
                                <select className="form-select" style={{ height: 46, fontSize: 14, padding: '0 16px', background: 'var(--bg-base)', cursor: 'pointer', fontWeight: 500 }} value={config.browser} onChange={e => setConfig({ ...config, browser: e.target.value })}>
                                    <option value="chrome">Google Chrome (Default)</option>
                                    <option value="firefox">Mozilla Firefox</option>
                                    <option value="edge">Microsoft Edge</option>
                                    <option value="brave">Brave Browser</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ marginBottom: 4, fontSize: 11 }}>Active Profile Name</label>
                                    <input className="form-input" style={{ height: 38, fontSize: 12, background: 'var(--bg-base)' }} value={config.profileName} onChange={e => setConfig({ ...config, profileName: e.target.value })} />
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ marginBottom: 4, fontSize: 11 }}>Profile Directory Path</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input className="form-input" style={{ height: 38, fontSize: 11, background: 'var(--bg-base)', flex: 1 }} value={config.profilePath} readOnly />
                                        <button className="btn btn-secondary" style={{ padding: '0 16px', height: 38, fontSize: 12, fontWeight: 600 }} onClick={() => handleBrowseFolder('profilePath')}>Browse</button>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ marginBottom: 4, fontSize: 11 }}>Resource Storage Path</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input className="form-input" style={{ height: 38, fontSize: 11, background: 'var(--bg-base)', flex: 1 }} value={config.resourcePath} readOnly />
                                        <button className="btn btn-secondary" style={{ padding: '0 16px', height: 38, fontSize: 12, fontWeight: 600 }} onClick={() => handleBrowseFolder('resourcePath')}>Browse</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section: Connectivity */}
                        <div style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Network Proxy</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input type="checkbox" id="useProxy" checked={config.useProxy} onChange={e => setConfig({ ...config, useProxy: e.target.checked })} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                                    <label htmlFor="useProxy" style={{ fontSize: 11, fontWeight: 700, cursor: 'pointer', color: 'var(--text-primary)' }}>Enabled</label>
                                </div>
                            </div>

                            {config.useProxy ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 12 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ marginBottom: 2, fontSize: 10 }}>Server URL</label>
                                        <input className="form-input" placeholder="host:port" style={{ height: 36, fontSize: 11, background: 'var(--bg-base)' }} value={config.proxyServer} onChange={e => setConfig({ ...config, proxyServer: e.target.value })} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ marginBottom: 2, fontSize: 10 }}>User</label>
                                        <input className="form-input" style={{ height: 36, fontSize: 11, background: 'var(--bg-base)' }} value={config.proxyUser} onChange={e => setConfig({ ...config, proxyUser: e.target.value })} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ marginBottom: 2, fontSize: 10 }}>Pass</label>
                                        <input type="password" className="form-input" style={{ height: 36, fontSize: 11, background: 'var(--bg-base)' }} value={config.proxyPass} onChange={e => setConfig({ ...config, proxyPass: e.target.value })} />
                                    </div>
                                </div>
                            ) : (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>Using direct system connection</div>
                            )}
                        </div>

                        <button className="btn btn-primary" style={{ height: 48, width: '100%', fontWeight: 700, borderRadius: 'var(--radius-md)', gap: 12, fontSize: 14, boxShadow: 'var(--shadow-md)' }} onClick={handleOpenBrowserSetup}>
                            <span style={{ fontSize: 18 }}>🌐</span> Open Configured Browser
                        </button>
                    </div>
                </div>

                {/* 3. Bottom Left: Step List */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                        <span className="card-title" style={{ fontSize: 13, fontWeight: 700 }}>Operation Timeline</span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                        {!steps.length ? (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                <div style={{ fontSize: 32, opacity: 0.3 }}>📋</div>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>No steps recorded yet</div>
                                <div style={{ fontSize: 11, maxWidth: 200 }}>Start training to see the agent's planned actions here.</div>
                            </div>
                        ) : (
                            steps.map((s, idx) => (
                                <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: idx === steps.length - 1 ? 'none' : '1px solid var(--border)' }}>
                                    <div style={{
                                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                                        background: s.status === 'done' ? 'var(--success-dim)' : s.status === 'active' ? 'var(--accent)' : 'var(--bg-elevated)',
                                        color: s.status === 'active' ? '#fff' : s.status === 'done' ? 'var(--success)' : 'var(--text-muted)',
                                        border: '1px solid ' + (s.status === 'active' ? 'var(--accent)' : 'var(--border)')
                                    }}>
                                        {s.status === 'done' ? '✓' : idx + 1}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: s.status === 'active' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{s.title}</div>
                                        {s.status === 'active' && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2, fontWeight: 500 }}>Currently executing...</div>}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 4. Bottom Right: Logs */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                        <span className="card-title" style={{ fontSize: 13, fontWeight: 700 }}>System Telemetry</span>
                    </div>
                    <div className="log-viewer" style={{ flex: 1, padding: 12, background: '#0d1117', color: '#e6edf3', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {!logs.length ? (
                            <div style={{ color: '#8b949e', textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                <div style={{ fontSize: 24, opacity: 0.3 }}>⌨️</div>
                                <div>Waiting for telemetry data...</div>
                            </div>
                        ) : (
                            logs.map(l => (
                                <div key={l.id} className="log-line" style={{ marginBottom: 2, borderLeft: '2px solid ' + (l.level === 'error' ? 'var(--danger)' : l.level === 'warn' ? 'var(--warning)' : 'transparent'), paddingLeft: 6 }}>
                                    <span style={{ color: '#8b949e', marginRight: 8, fontSize: 10 }}>[{new Date(l.timestamp).toLocaleTimeString()}]</span>
                                    <span className="log-msg" style={{ opacity: 0.9 }}>{l.message}</span>
                                </div>
                            ))
                        )}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
}
