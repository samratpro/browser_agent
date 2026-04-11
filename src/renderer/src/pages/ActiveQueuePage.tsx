import { useState, useEffect } from 'react';
import { Task, AgentState } from '../../../shared/types/AgentTypes';
import { useNavigate } from 'react-router-dom';

export default function ActiveQueuePage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    const navigate = useNavigate();

    // Mock load for now - should hook into electron API
    useEffect(() => {
        const load = async () => {
            try {
                const data = await window.electronAPI?.getTasks();
                if (data) {
                    // Show active tasks, plus completed/failed so they don't unexpectedly disappear when finished
                    const active = data.filter((t: Task) => 
                        [AgentState.EXPLORING, AgentState.PLANNING, AgentState.EXECUTING, AgentState.LEARNING, AgentState.COMPLETED, AgentState.FAILED, AgentState.WAITING_USER, AgentState.PAUSED, AgentState.REPAIRING].includes(t.state)
                    );
                    setTasks(active);
                    if (!activeTaskId && active.length > 0) {
                        setActiveTaskId(active[0].id);
                    }
                }
            } catch (err) {
                console.error('Failed to load active tasks', err);
            }
        };
        load();
        const iv = setInterval(load, 2000);
        return () => clearInterval(iv);
    }, [activeTaskId]);

    const activeTask = tasks.find(t => t.id === activeTaskId);

    return (
        <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
            {/* Left Sidebar: Active Tasks List */}
            <div style={{ 
                width: 300, 
                borderRight: '1px solid var(--border)', 
                background: 'var(--bg-surface)',
                display: 'flex', flexDirection: 'column' 
            }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                    Active Tasks ({tasks.length})
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                    {tasks.length === 0 ? (
                        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            No active tasks running.<br/>
                            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/')}>
                                Start a Task
                            </button>
                        </div>
                    ) : (
                        tasks.map(task => (
                            <div 
                                key={task.id}
                                onClick={() => setActiveTaskId(task.id)}
                                style={{
                                    padding: '16px',
                                    borderRadius: '14px',
                                    marginBottom: 10,
                                    cursor: 'pointer',
                                    background: activeTaskId === task.id ? 'var(--bg-active)' : 'var(--bg-elevated)',
                                    border: `1px solid ${activeTaskId === task.id ? 'var(--accent)' : 'var(--border)'}`,
                                    boxShadow: activeTaskId === task.id ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
                                    transition: 'all var(--transition-fast)',
                                    display: 'flex', flexDirection: 'column', gap: 6,
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                            >
                                {activeTaskId === task.id && (
                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--accent)' }} />
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }} className="truncate">
                                        {task.name || 'Untitled Task'}
                                    </span>
                                    <span className="badge badge-planning" style={{ fontSize: 9 }}>
                                        {task.trained ? 'AUTONOMOUS' : 'TRAINING'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                                    <div style={{ flex: 1, height: 4, background: 'var(--bg-base)', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ 
                                            height: '100%', 
                                            width: `${task.progress || (task.state === AgentState.COMPLETED ? 100 : 0)}%`,
                                            background: task.state === AgentState.FAILED ? 'var(--danger)' : 'var(--accent)',
                                            transition: 'width 0.4s'
                                        }} />
                                    </div>
                                    <span style={{ 
                                        fontSize: 10, 
                                        fontWeight: 600, 
                                        color: task.state === AgentState.COMPLETED ? 'var(--success)' : 
                                               task.state === AgentState.FAILED ? 'var(--danger)' : 'var(--text-muted)'
                                    }}>
                                        {task.state}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Details Panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', position: 'relative' }}>
                {activeTask ? (
                    <>
                        {/* Top Control Bar */}
                        <div style={{ 
                            padding: '16px 24px', borderBottom: '1px solid var(--border)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 18 }}>{activeTask.name || 'Untitled Task'}</h2>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                    Target URL: {activeTask.targetUrl || 'Unknown'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button 
                                    className="btn btn-secondary" 
                                    title="Execution Parameters"
                                    onClick={() => {}}
                                    style={{ padding: '10px 18px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)' }}
                                >
                                    <span style={{ marginRight: 8 }}>⚙</span> Configure Browser
                                </button>
                                <button 
                                    className="btn btn-danger btn-sm" 
                                    style={{ opacity: 0.9, borderRadius: 'var(--radius-pill)' }}
                                    onClick={async () => {
                                        if (activeTask && window.confirm('Are you sure you want to terminate this mission?')) {
                                            await window.electronAPI.stopTask(activeTask.id);
                                        }
                                    }}
                                >
                                    <span style={{ fontSize: 13 }}>⏹</span> <b>Terminate Mission</b>
                                </button>
                                <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
                                <button className="btn btn-primary btn-sm" style={{ borderRadius: 'var(--radius-pill)' }}>
                                    <span style={{ fontSize: 13, filter: 'brightness(10)' }}>🌐</span> Open Visual Browser
                                </button>
                            </div>
                        </div>

                        {/* Split Panels (Logs & Status) */}
                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            
                            {/* Live Logs (Center) */}
                            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
                                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    LIVE LOGS
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                                    {/* Console Header */}
                                    <div style={{ padding: '6px 12px', background: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #333' }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
                                        <span style={{ fontSize: 10, color: '#666', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>mission_telemetry.log</span>
                                    </div>
                                    <div style={{ flex: 1, overflowY: 'auto', padding: 16, fontFamily: 'var(--font-mono)', fontSize: 13, background: '#0a0a0a', color: '#d1d5db', lineHeight: 1.6 }}>
                                        <div style={{ color: 'var(--success)', marginBottom: 6 }}>
                                            <span style={{ opacity: 0.5, marginRight: 8 }}>[14:22:01]</span>
                                            ✔ Opened website (LinkedIn)
                                        </div>
                                        <div style={{ color: 'var(--success)', marginBottom: 6 }}>
                                            <span style={{ opacity: 0.5, marginRight: 8 }}>[14:22:04]</span>
                                            ✔ Navigated to Inbox
                                        </div>
                                        <div style={{ color: 'var(--success)', marginBottom: 6 }}>
                                            <span style={{ opacity: 0.5, marginRight: 8 }}>[14:22:05]</span>
                                            ✔ Opened chat
                                        </div>
                                        <div style={{ color: 'var(--warning)', marginBottom: 6, background: 'rgba(245, 158, 11, 0.05)', padding: '2px 0' }}>
                                            <span style={{ opacity: 0.5, marginRight: 8 }}>[14:22:08]</span>
                                            ⚠ Read lead name failed → Retrying regex fallback
                                        </div>
                                        <div style={{ color: 'var(--success)', marginBottom: 6 }}>
                                            <span style={{ opacity: 0.5, marginRight: 8 }}>[14:22:10]</span>
                                            ✔ Extracted "John Doe"
                                        </div>
                                        <div style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                            <span className="dot-running" style={{ display: 'inline-block', marginRight: 8 }}></span>
                                            Typing personalized message autonomously...
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Status & Thinking Sidebar (Right) */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>
                                {/* Status Panel */}
                                <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AGENT STATUS</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <div style={{ 
                                            width: 8, height: 8, borderRadius: '50%', 
                                            background: activeTask.state === AgentState.COMPLETED ? 'var(--success)' : 
                                                        activeTask.state === AgentState.FAILED ? 'var(--danger)' : 
                                                        activeTask.state === AgentState.REPAIRING ? 'var(--warning)' : 'var(--info)' 
                                        }} />
                                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                                            {activeTask.state === AgentState.REPAIRING ? 'Repairing Selector...' : activeTask.state}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                        {activeTask.state === AgentState.REPAIRING 
                                            ? 'The agent is dynamically fixing a broken locator.' 
                                            : activeTask.state === AgentState.COMPLETED 
                                            ? 'Mission goal reached successfully.'
                                            : activeTask.state === AgentState.FAILED
                                            ? 'Agent stopped. Review results or patterns.'
                                            : 'Executing autonomous planning steps.'}
                                    </div>
                                </div>

                                {/* Thinking Panel */}
                                <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AGENT THINKING</div>
                                    
                                    <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PAGE TYPE</div>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>
                                            {activeTask.pageType || 'Detecting...'}
                                        </div>
                                    </div>

                                    <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>STRATEGY</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ color: activeTask.strategy === 'exact' ? 'var(--success)' : 'var(--warning)', fontSize: 16 }}>●</span>
                                            <span style={{ fontSize: 13, fontWeight: 500, textTransform: 'uppercase' }}>
                                                {activeTask.strategy || 'Evaluating...'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                            {activeTask.currentSelector || 'Waiting for action...'}
                                        </div>
                                    </div>

                                    <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>CONFIDENCE</div>
                                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                                            {activeTask.confidence ? `${Math.round(activeTask.confidence * 100)}% Match` : 'Analyzing Context...'}
                                        </div>
                                        <div style={{ height: 4, background: 'var(--bg-surface)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${(activeTask.confidence || 0) * 100}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* Result & Pattern Panel (Bottom Area) */}
                        <div style={{ height: '35%', borderTop: '2px solid var(--border)', display: 'flex', background: 'var(--bg-surface)' }}>
                            {/* Results Table/Metrics */}
                            <div style={{ flex: 1.5, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>RESULTS</span>
                                    {(activeTask.state === AgentState.COMPLETED || activeTask.state === AgentState.FAILED) && (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button 
                                                className="btn btn-secondary btn-sm" 
                                                style={{ padding: '4px 12px', fontSize: 10, borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)' }}
                                                onClick={() => navigate('/', { state: { goal: activeTask.prompt } })}
                                            >
                                                🔁 Improve Goal
                                            </button>
                                            <button 
                                                className="btn btn-primary btn-sm" 
                                                style={{ padding: '4px 12px', fontSize: 10, borderRadius: 'var(--radius-pill)' }}
                                                onClick={async () => {
                                                    await window.electronAPI.runTask({
                                                        prompt: activeTask.prompt,
                                                        url: activeTask.targetUrl || activeTask.domain,
                                                        // ... other params from activeTask if available
                                                    });
                                                    navigate('/queue');
                                                }}
                                            >
                                                ▶ Run Again
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                                    {activeTask.extractedData && activeTask.extractedData.length > 0 ? (
                                        <table style={{ width: '100%', fontSize: 12 }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ textAlign: 'left', padding: 8 }}>Name / Co</th>
                                                    <th style={{ textAlign: 'left', padding: 8 }}>Email / Contact</th>
                                                    <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeTask.extractedData.map((res: any, idx: number) => (
                                                    <tr key={idx}>
                                                        <td style={{ padding: '14px 12px' }}>
                                                            <div style={{ fontWeight: 600 }}>{res.name || res.company || res.companyName || 'Lead Item'}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Extracted 2m ago</div>
                                                        </td>
                                                        <td style={{ padding: '14px 12px', color: 'var(--accent)', fontWeight: 500 }}>
                                                            {res.email || res.phone || res.contact || 'No data found'}
                                                        </td>
                                                        <td style={{ padding: '14px 12px' }}>
                                                            <span className={`badge ${res.status === 'success' ? 'badge-success' : 'badge-failed'}`} style={{ fontSize: 10 }}>
                                                                {res.status || 'Extracted'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                                            No results collected yet.<br/>The agent is currently exploring and planning.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Learned Pattern (JSON) */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                                    LEARNED PATTERN (JSON)
                                </div>
                                <div style={{ flex: 1, padding: 12, overflow: 'hidden' }}>
                                    <pre style={{ 
                                        margin: 0, padding: 12, background: 'var(--bg-base)', borderRadius: 8, height: '100%', overflowY: 'auto',
                                        fontSize: 11, color: 'var(--info)', fontFamily: 'var(--font-mono)', border: '1px solid var(--border)'
                                    }}>
                                        {activeTask.learnedPattern ? JSON.stringify(activeTask.learnedPattern, null, 2) : '// Searching for stable structure...'}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                        Select a task to view its live mission control.
                    </div>
                )}
            </div>

            {/* Bottom Telemetry Bar */}
            <div style={{ 
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, 
                background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 11, color: 'var(--text-muted)',
                gap: 24, zIndex: 10
            }}>
                <div><span style={{ opacity: 0.5 }}>CPU:</span> 14%</div>
                <div><span style={{ opacity: 0.5 }}>Mem:</span> 842MB</div>
                <div><span style={{ opacity: 0.5 }}>Sessions:</span> {tasks.length}</div>
                <div><span style={{ opacity: 0.5 }}>Playwright Drivers:</span> {tasks.length > 0 ? 1 : 0}</div>
            </div>
        </div>
    );
}
