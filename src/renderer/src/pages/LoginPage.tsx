import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setError('');
        const u = username.trim();
        const p = password.trim();

        if (!u || !p) {
            setError('Please enter both username and password.');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await login(u, p);
            if (result.success) {
                navigate('/', { replace: true });
            } else {
                setError(result.message || 'Invalid credentials.');
            }
        } catch {
            setError('An error occurred during login. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openExternal = (url: string) => {
        if (window.electronAPI) {
            window.electronAPI.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    };

    return (
        <div className="login-wrapper">
            {/* Custom Titlebar */}
            <div className="titlebar">
                <div style={{ width: 60 }} />
                <span className="titlebar-title">AI Browser Agent</span>
                <div className="titlebar-buttons">
                    <button
                        className="titlebar-btn"
                        style={{ background: 'var(--text-muted)', fontSize: 10 }}
                        onClick={toggleTheme}
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        {theme === 'dark' ? '☀' : '☾'}
                    </button>
                    <button className="titlebar-btn minimize" onClick={() => window.electronAPI?.windowMinimize()} />
                    <button className="titlebar-btn maximize" onClick={() => window.electronAPI?.windowMaximize()} />
                    <button className="titlebar-btn close" onClick={() => window.electronAPI?.windowClose()} />
                </div>
            </div>

            {/* Login Form */}
            <div className="login-container">
                <form className="login-card" onSubmit={handleSubmit}>
                    {/* Logo */}
                    <div className="login-logo">
                        <div style={{
                            width: 60, height: 60,
                            background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
                            borderRadius: 16,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px',
                            fontSize: 22, fontWeight: 800, color: '#fff',
                            boxShadow: 'var(--shadow-glow)',
                        }}>
                            AI
                        </div>
                        <h1>AI Browser Agent</h1>
                        <p>Self-Learning Automation Engine</p>
                    </div>

                    {/* Error */}
                    {error && <div className="login-error">{error}</div>}

                    {/* Username */}
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoFocus
                            autoComplete="username"
                        />
                    </div>

                    {/* Password */}
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="form-input"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                        />
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        className="btn btn-primary w-full"
                        disabled={isSubmitting}
                        style={{ opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                    >
                        {isSubmitting
                            ? <><span className="spinner" /> Checking access...</>
                            : 'Sign In'
                        }
                    </button>

                    {/* Footer links */}
                    <div className="login-footer">
                        <button type="button" className="login-link" onClick={() => openExternal('https://example.com/forgot-password')}>
                            Forgot Password?
                        </button>
                        <button type="button" className="login-link" onClick={() => openExternal('https://example.com/register')}>
                            Create Account
                        </button>
                    </div>

                    {/* Developer footer */}
                    <div style={{ marginTop: 24, borderTop: '1px dashed var(--border)', paddingTop: 20, textAlign: 'center' }}>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                            Developed by <strong style={{ color: 'var(--text-primary)' }}>Samrat</strong>
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                            <button
                                type="button"
                                onClick={() => openExternal('https://www.linkedin.com/in/samratx/')}
                                style={{
                                    padding: '5px 14px', borderRadius: 16,
                                    background: 'var(--accent)', color: 'white',
                                    border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                LinkedIn
                            </button>
                            <button
                                type="button"
                                onClick={() => openExternal('https://www.facebook.com/samratux/')}
                                style={{
                                    padding: '5px 14px', borderRadius: 16,
                                    background: 'var(--bg-hover)', color: 'var(--text-primary)',
                                    border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                Facebook
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
