import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface NavItem {
    path: string;
    icon: string;
    label: string;
}

const NAV_ITEMS: NavItem[] = [
    { path: '/', icon: '⊞', label: 'Dashboard' },
    { path: '/tasks', icon: '▶', label: 'Tasks' },
    { path: '/patterns', icon: '◈', label: 'Patterns' },
    { path: '/scheduler', icon: '⏰', label: 'Scheduler' },
    { path: '/logs', icon: '≡', label: 'Logs' },
    { path: '/settings', icon: '⚙', label: 'Settings' },
];

export default function Sidebar({ collapsed, onToggle }: {
    collapsed: boolean;
    onToggle: () => void;
}) {
    const { logout, user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            {/* Logo Header */}
            <div className="sidebar-header">
                <div className="sidebar-logo">AI</div>
                {!collapsed && <span className="sidebar-title">Browser Agent</span>}
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/'}
                        className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                        title={collapsed ? item.label : undefined}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Bottom actions */}
            <div className="sidebar-bottom">
                {/* Theme toggle */}
                <button
                    className="sidebar-collapse-btn"
                    onClick={toggleTheme}
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    style={{ width: '100%', gap: 8, marginBottom: 4 }}
                >
                    <span>{theme === 'dark' ? '☀' : '☾'}</span>
                    {!collapsed && <span style={{ fontSize: 12 }}>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
                </button>

                {/* User / Logout */}
                {!collapsed && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)', marginBottom: 4,
                    }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: 'var(--accent-dim)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--accent)', fontSize: 12, fontWeight: 700, flexShrink: 0,
                        }}>
                            {user?.[0]?.toUpperCase() ?? 'U'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user ?? 'User'}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Administrator</div>
                        </div>
                        <button
                            onClick={() => logout()}
                            title="Logout"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: 4 }}
                        >
                            ⏏
                        </button>
                    </div>
                )}

                {/* Collapse toggle */}
                <button className="sidebar-collapse-btn" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
                    {collapsed ? '›' : '‹'}
                </button>
            </div>
        </aside>
    );
}
