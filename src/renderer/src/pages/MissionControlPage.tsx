import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function MissionControlPage() {
    const [goal, setGoal] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const state = location.state as { goal?: string };
        if (state?.goal) {
            setGoal(state.goal);
        }
    }, [location]);

    // Settings State
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

    useEffect(() => {
        // Load default paths when component mounts
        window.electronAPI?.getDefaultPaths?.().then((paths: any) => {
            if (paths) {
                setConfig(prev => ({
                    ...prev,
                    profilePath: paths.profiles,
                    resourcePath: paths.tasks
                }));
            }
        }).catch(() => {});
    }, []);

    const handleBrowseFolder = async (field: 'profilePath' | 'resourcePath') => {
        if (!window.electronAPI) return;
        const path = await window.electronAPI.openFolderDialog(config[field]);
        if (path) {
            setConfig(prev => ({ ...prev, [field]: path }));
        }
    };

    const handleStart = async () => {
        if (!goal.trim()) return;
        // The start trigger will eventually pass `config` along with `goal`
        console.log('Starting task with goal:', goal, 'Config:', config);
        navigate('/active');
    };

    return (
        <div className="page-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', minHeight: 'min-content' }}>
            
            <div style={{ maxWidth: 700, width: '100%', textAlign: 'center', margin: 'auto' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
                <h1 style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                    What do you want the agent to do?
                </h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 16 }}>
                    Describe your goal. The agent will autonomously plan, execute, and learn the pattern.
                </p>

                <div style={{ 
                    background: 'var(--bg-glass)', 
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--border-strong)', 
                    borderRadius: 'var(--radius-lg)', 
                    padding: '24px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 20,
                    boxShadow: 'var(--shadow-lg)',
                    transition: 'box-shadow var(--transition-fast)',
                    textAlign: 'left'
                }} className="glass-panel">
                    <div style={{ position: 'relative' }}>
                        <textarea 
                            value={goal}
                            onChange={e => setGoal(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                    e.preventDefault();
                                    handleStart();
                                }
                            }}
                            autoFocus
                            placeholder="Describe your mission goals..."
                            style={{
                                width: '100%', height: 120, background: 'transparent', border: 'none', resize: 'none',
                                color: 'var(--text-primary)', fontSize: 18, outline: 'none', fontFamily: 'inherit',
                                lineHeight: 1.6, paddingBottom: 40
                            }}
                        />
                        <div style={{ position: 'absolute', right: 0, bottom: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                            Press <kbd style={{ background: 'var(--bg-elevated)', padding: '2px 4px', borderRadius: 4 }}>Ctrl + Enter</kbd> to launch
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                        <button 
                            className="btn btn-secondary" 
                            title="Execution Parameters"
                            onClick={() => setIsSettingsOpen(true)}
                            style={{ padding: '10px 18px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)' }}
                        >
                            <span style={{ marginRight: 8 }}>⚙</span> Configure Browser
                        </button>

                        <button 
                            className="btn btn-primary" 
                            onClick={handleStart}
                            disabled={!goal.trim()}
                            style={{ 
                                padding: '12px 32px', 
                                fontSize: 16, 
                                fontWeight: 700, 
                                borderRadius: 'var(--radius-pill)', 
                                display: 'flex', 
                                gap: 10, 
                                alignItems: 'center',
                                boxShadow: goal.trim() ? 'var(--shadow-glow)' : 'none'
                             }}
                        >
                            <span>🚀</span> Launch Mission
                        </button>
                    </div>
                </div>

                {/* Suggestions */}
                <div style={{ marginTop: 48, textAlign: 'left', background: 'var(--bg-elevated)', padding: '24px 32px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14 }}>🔍</span> Sample Autonomous Missions
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <SuggestionChip icon="🏢" text="Scrape software agencies from Clutch.co" onClick={setGoal} />
                        <SuggestionChip icon="🔗" text="Extract contact emails from startup websites" onClick={setGoal} />
                        <SuggestionChip icon="💼" text="Find development companies on LinkedIn" onClick={setGoal} />
                        <SuggestionChip icon="📩" text="Send introduction messages to LinkedIn leads" onClick={setGoal} />
                        <SuggestionChip icon="🚀" text="Auto-apply to job postings on LinkedIn" onClick={setGoal} />
                        <SuggestionChip icon="🛠" text="Test login and checkout flows on staging" onClick={setGoal} />
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            {isSettingsOpen && (
                <div style={{ 
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 
                }}>
                    <div style={{ 
                        background: 'var(--bg-elevated)', width: 650, maxHeight: '90%', overflowY: 'auto',
                        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                        display: 'flex', flexDirection: 'column'
                    }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)' }}>
                            <div>
                                <h2 style={{ fontSize: 18, margin: 0, color: 'var(--text-primary)' }}>Execution Parameters</h2>
                                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Configure browser, authentication, and environment</p>
                            </div>
                            <button onClick={() => setIsSettingsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 24, cursor: 'pointer', outline: 'none' }}>&times;</button>
                        </div>
                        
                        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {/* Authentication */}
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Authentication (Optional)</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Target URL</label>
                                        <input className="form-input" placeholder="https://..." value={config.url} onChange={e => setConfig({ ...config, url: e.target.value })} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Email / Username</label>
                                        <input className="form-input" value={config.email} onChange={e => setConfig({ ...config, email: e.target.value })} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Password</label>
                                        <input type="password" className="form-input" value={config.password} onChange={e => setConfig({ ...config, password: e.target.value })} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">2FA Code</label>
                                        <input className="form-input" value={config.twoFactor} onChange={e => setConfig({ ...config, twoFactor: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            {/* Browser Environment */}
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Browser Environment</div>
                                <div style={{ display: 'grid', gap: 16 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Select Browser Engine</label>
                                            <select className="form-select" value={config.browser} onChange={e => setConfig({ ...config, browser: e.target.value })}>
                                                <option value="chrome">Google Chrome (Default)</option>
                                                <option value="firefox">Mozilla Firefox</option>
                                                <option value="edge">Microsoft Edge</option>
                                                <option value="brave">Brave Browser</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Active Profile Name</label>
                                            <input className="form-input" value={config.profileName} onChange={e => setConfig({ ...config, profileName: e.target.value })} />
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Profile Directory Path</label>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input className="form-input" style={{ flex: 1 }} value={config.profilePath} readOnly />
                                            <button className="btn btn-secondary" onClick={() => handleBrowseFolder('profilePath')}>Browse</button>
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Resource Storage Path</label>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input className="form-input" style={{ flex: 1 }} value={config.resourcePath} readOnly />
                                            <button className="btn btn-secondary" onClick={() => handleBrowseFolder('resourcePath')}>Browse</button>
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                        <input type="checkbox" id="headlessMode" checked={config.headless} onChange={e => setConfig({ ...config, headless: e.target.checked })} style={{ cursor: 'pointer' }} />
                                        <label htmlFor="headlessMode" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>Run Headless (Hidden Browser)</label>
                                    </div>
                                </div>
                            </div>

                            {/* Network Proxy */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Network Proxy</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="checkbox" id="useProxy" checked={config.useProxy} onChange={e => setConfig({ ...config, useProxy: e.target.checked })} style={{ cursor: 'pointer' }} />
                                        <label htmlFor="useProxy" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>Enabled</label>
                                    </div>
                                </div>

                                {config.useProxy ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Server URL</label>
                                            <input className="form-input" placeholder="host:port" value={config.proxyServer} onChange={e => setConfig({ ...config, proxyServer: e.target.value })} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">User</label>
                                            <input className="form-input" value={config.proxyUser} onChange={e => setConfig({ ...config, proxyUser: e.target.value })} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label">Pass</label>
                                            <input type="password" className="form-input" value={config.proxyPass} onChange={e => setConfig({ ...config, proxyPass: e.target.value })} />
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px', background: 'var(--bg-base)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                                        Using direct system connection
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-base)' }}>
                            <button className="btn btn-primary" onClick={() => setIsSettingsOpen(false)} style={{ padding: '8px 24px' }}>
                                Save & Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            </div>
        </div>
    );
}

function SuggestionChip({ text, icon, onClick }: { text: string, icon: string, onClick: (t: string) => void }) {
    return (
        <div 
            onClick={() => onClick(text)}
            style={{ 
                background: 'var(--bg-surface)', 
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-pill)', 
                padding: '12px 18px', 
                fontSize: 13, 
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: 10
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'var(--bg-surface)';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span style={{ flex: 1 }}>{text}</span>
        </div>
    );
}
