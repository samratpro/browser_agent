import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Task, AgentState } from '../../../shared/types/AgentTypes';

interface NavItem {
    path: string;
    icon: string;
    label: string;
}

const NAV_ITEMS: NavItem[] = [
    { path: '/', icon: '🧠', label: 'New Task' },
    { path: '/active', icon: '▶', label: 'Active Queue' },
    { path: '/tasks', icon: '📋', label: 'Task Library' },
    { path: '/patterns', icon: '◈', label: 'Patterns' },
    { path: '/scheduler', icon: '⏰', label: 'Scheduler' },
    { path: '/logs', icon: '≡', label: 'Logs' },
    { path: '/settings', icon: '⚙', label: 'Settings' },
];

function taskStateDot(state: AgentState): string {
    if ([AgentState.PLANNING, AgentState.EXPLORING, AgentState.LEARNING, AgentState.EXECUTING].includes(state)) return 'dot-running';
    if (state === AgentState.COMPLETED) return 'dot-success';
    if (state === AgentState.FAILED) return 'dot-failed';
    if (state === AgentState.PAUSED || state === AgentState.WAITING_USER) return 'dot-paused';
    return 'dot-idle';
}

export default function Sidebar({ collapsed, onToggle }: {
    collapsed: boolean;
    onToggle: () => void;
}) {
    const { logout, user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState<Task[]>([]);

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    useEffect(() => {
        const load = async () => {
            try {
                const data = await window.electronAPI.getTasks();
                setTasks((data as Task[]).slice(0, 5));
            } catch { /* ignore */ }
        };
        load();
        const iv = setInterval(load, 3000);
        const unsub = window.electronAPI.onTaskUpdate(() => load());
        return () => { clearInterval(iv); unsub(); };
    }, []);

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

                {/* Task List */}
                {tasks.length > 0 && (
                    <div style={{ padding: '16px 8px', marginTop: 8, borderTop: '1px solid var(--border)' }}>
                        {!collapsed && (
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                RECENT TASKS
                            </div>
                        )}
                        {tasks.map((task) => (
                            <button
                                key={task.id}
                                onClick={() => navigate(`/tasks/${task.id}`)}
                                title={task.name}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    width: '100%', padding: '8px 10px',
                                    background: 'transparent', border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer', color: 'var(--text-secondary)',
                                    textAlign: 'left'
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = 'var(--bg-hover)';
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                }}
                            >
                                <span className={`task-status-dot ${taskStateDot(task.state)}`} style={{ 
                                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                    background: task.state === AgentState.COMPLETED ? 'var(--success)' : 
                                                task.state === AgentState.FAILED ? 'var(--danger)' : 'var(--info)'
                                }} />
                                {!collapsed && (
                                    <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {task.name}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
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