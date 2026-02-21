import { useEffect, useState } from 'react';
import { Pattern, PatternVersion, SelectorMap } from '../../../shared/types/AgentTypes';

function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString([], { dateStyle: 'medium' });
}

function SuccessRatePill({ rate }: { rate: number }) {
    const pct = Math.round(rate * 100);
    const color = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="progress-bar" style={{ width: 60 }}>
                <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span style={{ fontSize: 12, color }}>{pct}%</span>
        </div>
    );
}

export default function PatternsPage() {
    const [patterns, setPatterns] = useState<Pattern[]>([]);
    const [selected, setSelected] = useState<Pattern | null>(null);
    const [versions, setVersions] = useState<PatternVersion[]>([]);
    const [tab, setTab] = useState<'selectors' | 'versions'>('selectors');
    const [loading, setLoading] = useState(true);

    const loadPatterns = async () => {
        try {
            const data = await window.electronAPI.getPatterns();
            setPatterns(data as Pattern[]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadPatterns(); }, []);

    const openDetail = async (p: Pattern) => {
        setSelected(p);
        setTab('selectors');
        const v = await window.electronAPI.getPatternVersions(p.id);
        setVersions(v as PatternVersion[]);
    };

    const handleDisable = async (id: string, disabled: boolean) => {
        await window.electronAPI.disablePattern(id, disabled);
        await loadPatterns();
        if (selected?.id === id) setSelected((prev) => prev ? { ...prev, isDisabled: disabled } : null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this pattern? This cannot be undone.')) return;
        await window.electronAPI.deletePattern(id);
        await loadPatterns();
        if (selected?.id === id) setSelected(null);
    };

    const handleForceRelearn = async (id: string) => {
        await window.electronAPI.forceRelearn(id);
        await loadPatterns();
    };

    return (
        <div className="page animate-fade-in" style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
            {/* Pattern Table */}
            <div>
                <div className="page-header">
                    <h1 className="page-title">Patterns</h1>
                    <p className="page-subtitle">Learned automation patterns by domain</p>
                </div>

                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Name / Domain</th>
                                <th>Intent</th>
                                <th>Success Rate</th>
                                <th>Version</th>
                                <th>Updated</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>
                                    <div className="spinner" style={{ margin: '0 auto' }} />
                                </td></tr>
                            )}
                            {!loading && !patterns.length && (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                                    No patterns yet. Patterns are learned automatically as you run tasks.
                                </td></tr>
                            )}
                            {patterns.map((p) => (
                                <tr key={p.id} style={{ opacity: p.isDisabled ? 0.5 : 1 }}>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{p.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{p.domain}</div>
                                    </td>
                                    <td>
                                        <span className="badge badge-planning" style={{ textTransform: 'capitalize' }}>{p.intent}</span>
                                    </td>
                                    <td><SuccessRatePill rate={p.successRate} /></td>
                                    <td>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>v{p.currentVersion}</span>
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(p.updatedAt)}</td>
                                    <td>
                                        <div className="btn-row">
                                            <button className="btn btn-secondary btn-xs" onClick={() => openDetail(p)}>View</button>
                                            <button
                                                className="btn btn-secondary btn-xs"
                                                onClick={() => handleDisable(p.id, !p.isDisabled)}
                                                style={{ color: p.isDisabled ? 'var(--success)' : 'var(--warning)' }}
                                            >
                                                {p.isDisabled ? 'Enable' : 'Disable'}
                                            </button>
                                            <button className="btn btn-secondary btn-xs" onClick={() => handleForceRelearn(p.id)}
                                                title="Disables pattern so next run re-learns it">
                                                ↺
                                            </button>
                                            <button className="btn btn-danger btn-xs" onClick={() => handleDelete(p.id)}>✕</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Panel */}
            {selected && (
                <div className="card" style={{ height: 'fit-content', position: 'sticky', top: 0 }}>
                    <div className="card-header">
                        <span className="card-title" style={{ maxWidth: 200, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'block' }}>{selected.name}</span>
                        <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                        {(['selectors', 'versions'] as const).map((t) => (
                            <button key={t} onClick={() => setTab(t)}
                                className={`btn btn-${tab === t ? 'primary' : 'secondary'} btn-sm`}
                                style={{ flex: 1, textTransform: 'capitalize' }}>
                                {t}
                            </button>
                        ))}
                    </div>

                    {/* Selectors Tab */}
                    {tab === 'selectors' && (
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                                {Object.keys(selected.selectorMap).length} selectors
                            </div>
                            {Object.entries(selected.selectorMap as SelectorMap).map(([field, entry]) => (
                                <div key={field} style={{
                                    background: 'var(--bg-base)', borderRadius: 'var(--radius-md)',
                                    padding: '8px 10px', marginBottom: 6,
                                }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 3 }}>{field}</div>
                                    <code style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all', display: 'block' }}>
                                        {entry.selector}
                                    </code>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                                        {entry.selectorType} · {Math.round(entry.confidence * 100)}% confidence
                                    </div>
                                </div>
                            ))}
                            {!Object.keys(selected.selectorMap).length && (
                                <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>No selectors</div>
                            )}
                        </div>
                    )}

                    {/* Versions Tab */}
                    {tab === 'versions' && (
                        <div>
                            {versions.map((v) => (
                                <div key={v.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 13 }}>v{v.version}</span>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(v.createdAt)}</span>
                                    </div>
                                    {v.changeNote && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.changeNote}</div>}
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                        {Object.keys(v.selectorMap).length} selectors · {v.actions.length} actions
                                    </div>
                                </div>
                            ))}
                            {!versions.length && (
                                <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>No version history</div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
