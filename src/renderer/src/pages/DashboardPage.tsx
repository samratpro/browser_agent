import { useEffect, useState } from 'react';
import type { DashboardStats, LogEntry } from '../../../shared/types/AgentTypes';

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    const loadStats = async () => {
        try {
            const data = await window.electronAPI.getDashboardStats();
            setStats(data as DashboardStats);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 5000);
        return () => clearInterval(interval);
    }, []);

    // Live updates
    useEffect(() => {
        const unsub = window.electronAPI.onTaskUpdate(() => loadStats());
        return unsub;
    }, []);

    const statCards = [
        { label: 'Active Tasks', value: stats?.activeTasks ?? 0, icon: '▶', color: 'var(--info)' },
        { label: 'Completed Tasks', value: stats?.completedTasks ?? 0, icon: '✓', color: 'var(--success)' },
        { label: 'Failed Tasks', value: stats?.failedTasks ?? 0, icon: '✕', color: 'var(--danger)' },
        { label: 'Patterns', value: stats?.totalPatterns ?? 0, icon: '◈', color: 'var(--accent)' },
        {
            label: 'Success Rate',
            value: `${Math.round((stats?.patternSuccessRate ?? 0) * 100)}%`,
            icon: '↑',
            color: 'var(--warning)',
        },
    ];

    return (
        <div className="page animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Dashboard</h1>
                <p className="page-subtitle">Overview of your automation system</p>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                {statCards.map((s) => (
                    <div key={s.label} className="stat-card" style={{ '--stat-color': s.color } as React.CSSProperties}>
                        <div className="stat-icon">{s.icon}</div>
                        <div className="stat-value">{loading ? '—' : s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Recent Activity */}
            <div className="card">
                <div className="card-header">
                    <span className="card-title">Recent Activity</span>
                    <button className="btn btn-secondary btn-sm" onClick={loadStats}>↺ Refresh</button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                        <div className="spinner" style={{ margin: '0 auto' }} />
                    </div>
                ) : !stats?.recentActivity?.length ? (
                    <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
                        No recent activity yet. Run a task to get started.
                    </div>
                ) : (
                    <div className="activity-feed">
                        {(stats.recentActivity as LogEntry[]).map((entry) => (
                            <div key={entry.id} className="activity-item">
                                <div className={`activity-dot ${entry.level}`} />
                                <div className="activity-content">
                                    <div className="activity-msg">{entry.message}</div>
                                    <div className="activity-time">{formatTime(entry.timestamp)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
