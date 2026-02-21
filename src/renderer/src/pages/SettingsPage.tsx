import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface Credential {
    id: string;
    domain: string;
    label: string;
    username: string;
    createdAt: number;
}

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const { logout, user } = useAuth();

    const [apiKey, setApiKey] = useState('');
    const [apiKeySaved, setApiKeySaved] = useState(false);
    const [credentials, setCredentials] = useState<Credential[]>([]);

    // New credential form
    const [credDomain, setCredDomain] = useState('');
    const [credLabel, setCredLabel] = useState('');
    const [credUser, setCredUser] = useState('');
    const [credPass, setCredPass] = useState('');
    const [addingCred, setAddingCred] = useState(false);

    const loadCredentials = async () => {
        const data = await window.electronAPI.getCredentials();
        setCredentials(data as Credential[]);
    };

    useEffect(() => { loadCredentials(); }, []);

    const saveApiKey = async () => {
        if (!apiKey.trim()) return;
        await window.electronAPI.setApiKey(apiKey.trim());
        setApiKeySaved(true);
        setTimeout(() => setApiKeySaved(false), 3000);
    };

    const handleAddCredential = async () => {
        if (!credDomain.trim() || !credLabel.trim() || !credUser.trim() || !credPass.trim()) return;
        setAddingCred(true);
        try {
            await window.electronAPI.addCredential({
                domain: credDomain, label: credLabel, username: credUser, password: credPass,
            });
            setCredDomain(''); setCredLabel(''); setCredUser(''); setCredPass('');
            await loadCredentials();
        } finally {
            setAddingCred(false);
        }
    };

    const handleDeleteCredential = async (id: string) => {
        if (!confirm('Delete this credential?')) return;
        await window.electronAPI.deleteCredential(id);
        await loadCredentials();
    };

    const openExternal = (url: string) => {
        if (window.electronAPI) window.electronAPI.openExternal(url);
        else window.open(url, '_blank');
    };

    return (
        <div className="page animate-fade-in" style={{ maxWidth: 680, margin: '0 auto' }}>
            <div className="page-header">
                <h1 className="page-title">Settings</h1>
                <p className="page-subtitle">Configure your automation engine</p>
            </div>

            {/* Account */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title" style={{ marginBottom: 14 }}>Account</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'var(--accent-dim)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: 'var(--accent)', fontSize: 18, fontWeight: 700,
                    }}>
                        {user?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div>
                        <div style={{ fontWeight: 600 }}>{user ?? 'User'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Administrator</div>
                    </div>
                    <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={logout}>
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Appearance */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title" style={{ marginBottom: 14 }}>Appearance</div>
                <div style={{ display: 'flex', gap: 10 }}>
                    {(['dark', 'light'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTheme(t)}
                            style={{
                                flex: 1, padding: '12px 0', borderRadius: 'var(--radius-md)',
                                border: `2px solid ${theme === t ? 'var(--accent)' : 'var(--border)'}`,
                                background: theme === t ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                                color: theme === t ? 'var(--accent)' : 'var(--text-secondary)',
                                cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'all var(--transition)',
                            }}
                        >
                            {t === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                        </button>
                    ))}
                </div>
            </div>

            {/* OpenAI API Key */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title" style={{ marginBottom: 4 }}>OpenAI API Key</div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                    Required for AI planning and selector recovery. Stored securely in your OS keychain — never sent anywhere else.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                    <input
                        type="password"
                        className="form-input"
                        placeholder="sk-..."
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
                    />
                    <button
                        className={`btn btn-${apiKeySaved ? 'secondary' : 'primary'}`}
                        onClick={saveApiKey}
                        disabled={!apiKey.trim()}
                        style={{ color: apiKeySaved ? 'var(--success)' : undefined }}
                    >
                        {apiKeySaved ? '✓ Saved' : 'Save'}
                    </button>
                </div>
                <button
                    className="login-link"
                    style={{ marginTop: 8 }}
                    onClick={() => openExternal('https://platform.openai.com/api-keys')}
                >
                    Get API key from OpenAI →
                </button>
            </div>

            {/* Credential Manager */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title" style={{ marginBottom: 4 }}>Credential Manager</div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                    Passwords are stored in the OS keychain, never in plain text. Credentials are never sent to OpenAI.
                </p>

                {/* Add Credential Form */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Domain</label>
                        <input className="form-input" placeholder="example.com" value={credDomain} onChange={(e) => setCredDomain(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Label</label>
                        <input className="form-input" placeholder="My Account" value={credLabel} onChange={(e) => setCredLabel(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Username / Email</label>
                        <input className="form-input" placeholder="user@example.com" value={credUser} onChange={(e) => setCredUser(e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Password</label>
                        <input type="password" className="form-input" placeholder="••••••••" value={credPass} onChange={(e) => setCredPass(e.target.value)} />
                    </div>
                </div>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={handleAddCredential}
                    disabled={addingCred || !credDomain.trim() || !credUser.trim() || !credPass.trim()}
                    style={{ marginBottom: 16 }}
                >
                    {addingCred ? <><span className="spinner" /> Adding...</> : '+ Add Credential'}
                </button>

                {/* Credential List */}
                {!credentials.length ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 16 }}>No credentials stored</div>
                ) : (
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                        <table>
                            <thead><tr><th>Domain</th><th>Label</th><th>Username</th><th></th></tr></thead>
                            <tbody>
                                {credentials.map((c) => (
                                    <tr key={c.id}>
                                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{c.domain}</td>
                                        <td>{c.label}</td>
                                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.username}</td>
                                        <td>
                                            <button className="btn btn-danger btn-xs" onClick={() => handleDeleteCredential(c.id)}>✕</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* About */}
            <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>About</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    <div><strong>AI Browser Agent</strong> — Self-Learning Automation Engine</div>
                    <div style={{ color: 'var(--text-muted)' }}>v1.0.0 · Built with Electron, React, Playwright</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                        Developed by <strong style={{ color: 'var(--text-primary)' }}>Samrat</strong>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <button
                        onClick={() => openExternal('https://www.linkedin.com/in/samratx/')}
                        style={{
                            padding: '6px 16px', borderRadius: 20, background: 'var(--accent)',
                            color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        LinkedIn
                    </button>
                    <button
                        onClick={() => openExternal('https://www.facebook.com/samratux/')}
                        style={{
                            padding: '6px 16px', borderRadius: 20, background: 'var(--bg-hover)',
                            color: 'var(--text-primary)', border: '1px solid var(--border)',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        Facebook
                    </button>
                </div>
            </div>
        </div>
    );
}
