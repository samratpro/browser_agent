import { useState, useEffect } from 'react';

interface Props {
    /** Pre-fill from browser config panel; user can change before launching */
    defaultProfileName?: string;
    defaultUrl?: string;
    onClose: () => void;
    /** Called with the saved profile name after browser closes */
    onProfileSaved?: (profileName: string) => void;
}

interface Profile {
    name: string;
    path: string;
    createdAt: number;
}

export default function BrowserSetupModal({ defaultProfileName = '', defaultUrl = '', onClose, onProfileSaved }: Props) {
    const [profileName, setProfileName] = useState(defaultProfileName || 'default');
    const [url, setUrl] = useState(defaultUrl);
    const [launching, setLaunching] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [profilesDir, setProfilesDir] = useState('');

    useEffect(() => {
        window.electronAPI.listBrowserProfiles().then((p) => setProfiles(p as Profile[]));
        window.electronAPI.getBrowserProfilesDir().then((d) => setProfilesDir(d as string));
    }, [done]);

    const handleLaunch = async () => {
        if (!profileName.trim()) return;
        setLaunching(true);
        setError('');
        setDone(false);
        try {
            await window.electronAPI.setupBrowserProfile(profileName.trim(), url.trim() || undefined);
            setDone(true);
            onProfileSaved?.(profileName.trim());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLaunching(false);
        }
    };

    const handleDelete = async (name: string) => {
        if (!confirm(`Delete profile "${name}"?`)) return;
        await window.electronAPI.deleteBrowserProfile(name);
        setProfiles((prev) => prev.filter((p) => p.name !== name));
    };

    return (
        <div className="captcha-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="captcha-modal" style={{ maxWidth: 520, textAlign: 'left' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                        <div style={{ fontSize: 20, marginBottom: 4 }}>🌐</div>
                        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Browser Profile Setup</h2>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
                            The browser will open so you can log in or configure it manually. When you close it, the session is saved automatically.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}
                    >✕</button>
                </div>

                {/* Launch form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Profile Name</label>
                        <input
                            className="form-input"
                            placeholder="e.g. default, work, amazon-account"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            disabled={launching}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Open URL on Launch (optional)</label>
                        <input
                            className="form-input"
                            placeholder="https://example.com/login"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            disabled={launching}
                        />
                    </div>

                    {error && (
                        <div className="login-error">{error}</div>
                    )}

                    {done && (
                        <div style={{ background: 'var(--success-dim)', border: '1px solid rgba(34,197,94,0.25)', color: 'var(--success)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
                            ✓ Profile <strong>"{profileName}"</strong> saved. You can now select it in the browser config.
                        </div>
                    )}

                    <button
                        className="btn btn-primary"
                        onClick={handleLaunch}
                        disabled={launching || !profileName.trim()}
                    >
                        {launching
                            ? <><span className="spinner" /> Browser is open — close it to save session...</>
                            : '🌐 Open Browser for Manual Setup'}
                    </button>
                </div>

                {/* Saved profiles list */}
                {profiles.length > 0 && (
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                            Saved Profiles
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {profiles.map((p) => (
                                <div key={p.name} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                }}>
                                    <span style={{ fontSize: 14 }}>👤</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {new Date(p.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-secondary btn-xs"
                                        onClick={() => { setProfileName(p.name); setDone(false); }}
                                    >
                                        Re-open
                                    </button>
                                    <button
                                        className="btn btn-danger btn-xs"
                                        onClick={() => handleDelete(p.name)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                        {profilesDir && (
                            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                Profiles stored in: {profilesDir}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}