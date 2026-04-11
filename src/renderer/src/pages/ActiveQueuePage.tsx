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
                                        {task.name || 'Untitled Mission'}
                                    </span>
                                    <span style={{ 
                                        fontSize: 9, 
                                        padding: '2px 8px', 
                                        borderRadius: 4, 
                                        background: 'var(--bg-base)',
                                        color: 'var(--accent)',
                                        fontWeight: 800,
                                        border: '1px solid var(--border)'
                                    }}>
                                        {(task.type || 'scraping').toUpperCase()}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                                    <div style={{ flex: 1, height: 4, background: 'var(--bg-base)', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ 
                                            height: '100%', 
                                            width: `${task.progress || (task.state === AgentState.COMPLETED ? 100 : 0)}%`,
                                            background: task.state === AgentState.FAILED ? 'var(--danger)' : 
                                                       task.state === AgentState.REPAIRING ? 'var(--warning)' : 
                                                       task.state === AgentState.VALIDATING ? '#28c840' : 'var(--accent)',
                                            transition: 'width 0.4s'
                                        }} />
                                    </div>
                                    <span style={{ 
                                        fontSize: 10, 
                                        fontWeight: 800, 
                                        color: task.state === AgentState.COMPLETED ? 'var(--success)' : 
                                               task.state === AgentState.FAILED ? 'var(--danger)' : 
                                               task.state === AgentState.PLANNING ? 'var(--info)' : 'var(--text-muted)'
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
                                    <div style={{ flex: 1, overflowY: 'auto', padding: 0, fontFamily: 'var(--font-mono)', fontSize: 12, background: '#0a0a0a', color: '#d1d5db' }}>
                                        {/* Premium Mission Logs */}
                                        <div style={{ borderBottom: '1px solid #1a1a1a', padding: '12px 16px', background: 'rgba(99, 102, 241, 0.05)' }}>
                                            <div style={{ display: 'flex', gap: 12 }}>
                                                <span style={{ color: 'var(--success)', fontWeight: 800 }}>[ACTION]</span>
                                                <span style={{ fontWeight: 600 }}>Navigate to Target URL</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                                                <span style={{ color: 'var(--info)', fontWeight: 800 }}>[RESULT]</span>
                                                <span>Page fully loaded in 2.1s</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                                                <span style={{ color: 'var(--warning)', fontWeight: 800 }}>[REASON]</span>
                                                <span style={{ opacity: 0.8 }}>Verify landing page state before exploration</span>
                                            </div>
                                        </div>

                                        <div style={{ borderBottom: '1px solid #1a1a1a', padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', gap: 12 }}>
                                                <span style={{ color: 'var(--success)', fontWeight: 800 }}>[ACTION]</span>
                                                <span style={{ fontWeight: 600 }}>Locate Search Bar</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                                                <span style={{ color: '#ff5f57', fontWeight: 800 }}>[RESULT]</span>
                                                <span>Exact selector failed</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                                                <span style={{ color: 'var(--warning)', fontWeight: 800 }}>[REASON]</span>
                                                <span style={{ opacity: 0.8 }}>Dynamic class name change detected</span>
                                            </div>
                                        </div>

                                        <div style={{ borderBottom: '1px solid #1a1a1a', padding: '12px 16px', background: 'rgba(234, 179, 8, 0.03)' }}>
                                            <div style={{ display: 'flex', gap: 12 }}>
                                                <span style={{ color: 'var(--accent)', fontWeight: 800 }}>[REPAIR]</span>
                                                <span style={{ fontWeight: 600 }}>Agentic Fallback Search</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                                                <span style={{ color: 'var(--success)', fontWeight: 800 }}>[RESULT]</span>
                                                <span>Found element via fuzzy text match "Search..."</span>
                                            </div>
                                        </div>

                                        <div style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', gap: 12 }}>
                                                <span className="dot-running" style={{ display: 'inline-block' }}></span>
                                                <span style={{ color: 'var(--accent)', fontWeight: 800 }}>[MISSION]</span>
                                                <span style={{ fontWeight: 600 }}>Autonomous execution in progress...</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Status & Thinking Sidebar (Right) */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}>
                                {/* Status Panel */}
                                <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>MISSION PHASE</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <div style={{ 
                                            width: 8, height: 8, borderRadius: '50%', 
                                            background: activeTask.state === AgentState.COMPLETED ? 'var(--success)' : 
                                                        activeTask.state === AgentState.FAILED ? 'var(--danger)' : 
                                                        activeTask.state === AgentState.REPAIRING ? 'var(--warning)' : 
                                                        activeTask.state === AgentState.VALIDATING ? '#28c840' : 'var(--info)' 
                                        }} className={activeTask.state !== AgentState.COMPLETED && activeTask.state !== AgentState.FAILED ? 'dot-running' : ''} />
                                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {activeTask.state}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        {activeTask.state === AgentState.PLANNING && 'Agent is analyzing goals and mapping browser routes.'}
                                        {activeTask.state === AgentState.EXECUTING && 'Agent is actively interacting with the page elements.'}
                                        {activeTask.state === AgentState.REPAIRING && 'A selector failed. The agent is using reasoning to find a fallback.'}
                                        {activeTask.state === AgentState.VALIDATING && 'Finalizing task and verifying extracted results.'}
                                        {activeTask.state === AgentState.COMPLETED && 'Mission goal successfully accomplished.'}
                                        {(activeTask.state !== AgentState.PLANNING && activeTask.state !== AgentState.EXECUTING && activeTask.state !== AgentState.REPAIRING && activeTask.state !== AgentState.VALIDATING && activeTask.state !== AgentState.COMPLETED) && 'Agent is waiting for the next instruction.'}
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

                                    <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>CONFIDENCE</div>
                                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                                            {activeTask.confidence ? `${Math.round(activeTask.confidence * 100)}% Match` : 'Analyzing Context...'}
                                        </div>
                                        <div style={{ height: 4, background: 'var(--bg-surface)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${(activeTask.confidence || 0) * 100}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
                                        </div>
                                    </div>

                                    <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>LOGIC & REASONING</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                                            {activeTask.reasoning || 'Agent is determining the optimal path based on visual cues and DOM structure.'}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* Result & Pattern Panel (Bottom Area) */}
                        <div style={{ height: '35%', borderTop: '2px solid var(--border)', display: 'flex', background: 'var(--bg-surface)' }}>
                            {/* Results Table/Metrics */}
                            <div style={{ flex: 1.5, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                        <span>RESULTS & METRICS</span>
                                        {activeTask.metrics && (
                                            <div style={{ display: 'flex', gap: 12, color: 'var(--accent)' }}>
                                                <span>✓ {activeTask.metrics.success || 0} Success</span>
                                                <span style={{ color: 'var(--danger)' }}>⚠ {activeTask.metrics.failed || 0} Failed</span>
                                                <span style={{ color: 'var(--text-muted)' }}>⏭ {activeTask.metrics.skipped || 0} Skipped</span>
                                            </div>
                                        )}
                                    </div>
                                    {(activeTask.state === AgentState.COMPLETED || activeTask.state === AgentState.FAILED) && (
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button 
                                                className="btn btn-secondary btn-sm" 
                                                style={{ padding: '4px 12px', fontSize: 10, borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)' }}
                                                onClick={() => {
                                                    const better = window.prompt("What should the agent do better in the next run?");
                                                    if (better) {
                                                        navigate('/', { state: { goal: `${activeTask.prompt}\n\nREFINEMENT: ${better}` } });
                                                    }
                                                }}
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
                                                    });
                                                    navigate('/queue');
                                                }}
                                            >
                                                ▶ Run Again
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
                                    {activeTask.extractedData && activeTask.extractedData.length > 0 ? (
                                        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1, boxShadow: '0 1px 0 var(--border)' }}>
                                                <tr>
                                                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>ENTITY</th>
                                                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>CONTACT / VALUE</th>
                                                    <th style={{ textAlign: 'left', padding: '12px 16px' }}>STATUS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeTask.extractedData.map((res: any, idx: number) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{res.name || res.company || 'Extracted Item'}</div>
                                                        </td>
                                                        <td style={{ padding: '12px 16px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                                                            {res.email || res.phone || res.contact || 'N/A'}
                                                        </td>
                                                        <td style={{ padding: '12px 16px' }}>
                                                            <span style={{ 
                                                                fontSize: 10, padding: '4px 8px', borderRadius: 4, 
                                                                background: res.status === 'success' ? 'rgba(40, 200, 64, 0.1)' : 'rgba(255, 95, 87, 0.1)',
                                                                color: res.status === 'success' ? '#28c840' : '#ff5f57',
                                                                fontWeight: 700
                                                            }}>
                                                                {(res.status || 'SUCCESS').toUpperCase()}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>
                                            <div style={{ maxWidth: 300 }}>
                                                <div style={{ fontSize: 32, marginBottom: 16 }}>📡</div>
                                                Waiting for the agent to extract the first set of results...
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                             {/* Learned Pattern (JSON) */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>LEARNED PATTERN</span>
                                    <button 
                                        className="btn btn-secondary btn-sm" 
                                        style={{ padding: '2px 8px', fontSize: 9 }}
                                        onClick={() => {
                                            if (activeTask.learnedPattern) {
                                                navigator.clipboard.writeText(JSON.stringify(activeTask.learnedPattern, null, 2));
                                                alert('Pattern copied to clipboard!');
                                            }
                                        }}
                                    >
                                        📋 Copy JSON
                                    </button>
                                </div>
                                <div style={{ flex: 1, padding: 12, overflow: 'hidden' }}>
                                    <div style={{ 
                                        margin: 0, padding: 12, background: 'var(--bg-base)', borderRadius: 8, height: '100%', overflowY: 'auto',
                                        fontSize: 11, color: '#eab308', fontFamily: 'var(--font-mono)', border: '1px solid var(--border)',
                                        whiteSpace: 'pre-wrap', lineHeight: 1.5
                                    }}>
                                        {activeTask.learnedPattern ? (
                                            <div style={{ color: '#8b5cf6' }}>
                                                <span style={{ color: '#6366f1' }}>"actions"</span>: [...],<br/>
                                                <span style={{ color: '#6366f1' }}>"strategies"</span>: &#123;<br/>
                                                &nbsp;&nbsp;<span style={{ color: '#ec4899' }}>"exact"</span>: <span style={{ color: '#10b981' }}>true</span>,<br/>
                                                &nbsp;&nbsp;<span style={{ color: '#ec4899' }}>"fallback"</span>: <span style={{ color: '#f59e0b' }}>"text_match"</span><br/>
                                                &#125;,<br/>
                                                <span style={{ color: '#6366f1' }}>"template"</span>: <span style={{ color: '#10b981' }}>"Hi &#123;&#123;name&#125;&#125;..."</span>
                                            </div>
                                        ) : (
                                            <div style={{ color: 'var(--text-muted)', border: '1px dashed var(--border)', padding: 12, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                                Searching for stable<br/>DOM structure...
                                            </div>
                                        )}
                                    </div>
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
