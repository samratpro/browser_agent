import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Task, AgentState, LogEntry } from '../../../shared/types/AgentTypes';

const STATES_ORDERED = [
    AgentState.PLANNING, AgentState.EXPLORING, AgentState.LEARNING,
    AgentState.EXECUTING, AgentState.COMPLETED,
];

function stateIndex(state: AgentState): number {
    return STATES_ORDERED.indexOf(state);
}

function formatTs(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function levelColor(level: string): string {
    const map: Record<string, string> = {
        info: 'var(--info)', warn: 'var(--warning)', error: 'var(--danger)', debug: 'var(--text-muted)',
    };
    return map[level] ?? 'var(--text-muted)';
}

export default function TaskDetailView() {
    const { taskId } = useParams<{ taskId: string }>();
    const navigate = useNavigate();

    const [task, setTask] = useState<Task | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [screenshot, setScreenshot] = useState<string>('');
    const [captcha, setCaptcha] = useState<{ msg: string; img?: string } | null>(null);
    const [learning, setLearning] = useState<{ actions: unknown[]; reasoning?: string } | null>(null);
    const [interruptMsg, setInterruptMsg] = useState('');
    const [sendingInterrupt, setSendingInterrupt] = useState(false);
    const [showSetupModal, setShowSetupModal] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const [viewMode, setViewMode] = useState<'train' | 'run'>('train');

    const loadTask = async () => {
        if (!taskId) return;
        const all = (await window.electronAPI.getTasks()) as Task[];
        const found = all.find((t) => t.id === taskId);
        if (found) {
            setTask(found);
            // Detect mode based on state if it's the first load or state changed significantly
            if (found.state === AgentState.EXECUTING && viewMode === 'train') {
                setViewMode('run');
            }
        }
    };

    const loadLogs = async () => {
        if (!taskId) return;
        const data = (await window.electronAPI.getTaskLogs(taskId)) as LogEntry[];
        setLogs(data);
        setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    useEffect(() => {
        loadTask();
        loadLogs();

        const unsubUpdate = window.electronAPI.onTaskUpdate((e: { taskId: string }) => {
            if (e.taskId === taskId) { loadTask(); }
        });

        const unsubLog = window.electronAPI.onTaskLogLine((e: { taskId: string; entry: LogEntry }) => {
            if (e.taskId === taskId) {
                setLogs((prev) => [...prev, e.entry].slice(-500));
                setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            }
        });

        const unsubShot = window.electronAPI.onTaskScreenshot((e: { taskId: string; base64: string }) => {
            if (e.taskId === taskId) setScreenshot(e.base64);
        });

        const unsubCaptcha = window.electronAPI.onCaptchaDetected((e: { taskId: string; screenshotBase64: string; message: string }) => {
            if (e.taskId === taskId) setCaptcha({ msg: e.message, img: e.screenshotBase64 });
        });

        const unsubLearning = window.electronAPI.onLearningComplete((e: { taskId: string; data: { actions: unknown[]; reasoning?: string } }) => {
            if (e.taskId === taskId) setLearning(e.data);
        });

        return () => {
            unsubUpdate(); unsubLog(); unsubShot(); unsubCaptcha(); unsubLearning();
        };
    }, [taskId]);

    const handleAction = async (action: 'pause' | 'resume' | 'stop') => {
        if (!taskId) return;
        const api = {
            pause: () => window.electronAPI.pauseTask(taskId),
            resume: () => window.electronAPI.resumeTask(taskId),
            stop: () => window.electronAPI.stopTask(taskId),
        };
        await api[action]();
        await loadTask();
    };

    const handleConfirmLearning = async () => {
        if (!taskId) return;
        await window.electronAPI.confirmLearning(taskId);
        setLearning(null);
    };

    const isActive = task && [AgentState.PLANNING, AgentState.EXPLORING, AgentState.LEARNING, AgentState.EXECUTING].includes(task.state);
    const isPaused = task && (task.state === AgentState.PAUSED || task.state === AgentState.WAITING_USER);
    const currentStateIdx = task ? stateIndex(task.state) : -1;

    if (!task) {
        return (
            <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <div style={{ color: 'var(--text-muted)' }}>Loading task...</div>
            </div>
        );
    }

    const renderTrainUI = () => (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 40%', gridTemplateRows: '1fr 1fr', gap: 20, flex: 1, minHeight: 0 }}>
            {/* 1. Top Left: Prompt area + Chat history */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="card-header">
                    <span className="card-title">Prompt & History</span>
                    <button className="btn btn-secondary btn-xs" onClick={() => setViewMode('run')}>Run View</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, padding: '0 4px' }}>
                    <div style={{ background: 'var(--accent-dim)', padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>USER PROMPT</div>
                        <div style={{ fontSize: 13 }}>{task.prompt}</div>
                    </div>
                    {task.errorMessage && (
                        <div style={{ background: 'var(--danger-dim)', padding: 10, borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: 12 }}>
                            <strong>System:</strong> {task.errorMessage}
                        </div>
                    )}
                    <div style={{ background: 'var(--bg-elevated)', padding: 10, borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)' }}>
                        <strong>System:</strong> {task.state === AgentState.COMPLETED ? 'Task finished successfully.' : 'Status: ' + task.state}
                    </div>
                </div>
                <div className="btn-row">
                    <button className="btn btn-primary btn-sm" disabled={!isActive} onClick={() => handleAction('resume')}>▶ Run Train Task</button>
                    <button className="btn btn-secondary btn-sm" onClick={handleConfirmLearning} disabled={!learning}>✓ Confirm Step</button>
                </div>
            </div>

            {/* 2. Top Right: Config Area */}
            <div className="card" style={{ overflowY: 'auto' }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Current Config Area</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>DOMAIN</div>
                        <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>{task.domain}</div>
                    </div>
                    {task.credentials?.url && (
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>TARGET URL</div>
                            <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{task.credentials.url}</div>
                        </div>
                    )}
                    {task.credentials?.email && (
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>EMAIL</div>
                            <div style={{ fontSize: 13 }}>{task.credentials.email}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Bottom Left: Step List */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="card-title" style={{ marginBottom: 12 }}>Step List</div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {task.executionGraph?.steps.map((s, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
                            <div style={{
                                width: 16, height: 16, borderRadius: '50%', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
                                background: s.status === 'success' ? 'var(--success)' : s.status === 'running' ? 'var(--accent)' : 'var(--bg-hover)',
                                color: '#fff'
                            }}>
                                {s.status === 'success' ? '✓' : i + 1}
                            </div>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600 }}>{s.action.type.toUpperCase()}</div>
                                {'selector' in s.action && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} className="truncate">{s.action.selector}</div>}
                            </div>
                        </div>
                    ))}
                    {!task.executionGraph?.steps.length && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>No execution steps yet.</div>}
                </div>
            </div>

            {/* 4. Bottom Right: Logs */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="card-title" style={{ marginBottom: 12 }}>Logs</div>
                <div className="log-viewer" style={{ flex: 1, fontSize: 11 }}>
                    {logs.slice(-100).map((l) => (
                        <div key={l.id} className="log-line">
                            <span className="log-msg" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.message}</span>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );

    const renderRunUI = () => (
        <>
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                    <span className="card-title">State Timeline</span>
                    <button className="btn btn-secondary btn-xs" onClick={() => setViewMode('train')}>Train View</button>
                </div>
                <div className="state-timeline">
                    {STATES_ORDERED.map((s, i) => (
                        <React.Fragment key={s}>
                            {i > 0 && (
                                <div className={`timeline-connector ${i <= currentStateIdx ? 'done' : ''}`} />
                            )}
                            <div className="timeline-step">
                                <div className={`timeline-dot ${s === task.state ? 'active' : i < currentStateIdx ? 'done' : ''}`}>
                                    {i < currentStateIdx ? '✓' : i + 1}
                                </div>
                                <div className="timeline-label">{s}</div>
                            </div>
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, flex: 1 }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="card-title" style={{ marginBottom: 12 }}>Live Browser</div>
                    <div className="screenshot-viewer" style={{ flex: 1 }}>
                        {screenshot ? <img src={`data:image/jpeg;base64,${screenshot}`} alt="Live view" /> : <div className="screenshot-placeholder">Waiting for browser...</div>}
                    </div>
                </div>
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="card-title" style={{ marginBottom: 12 }}>Execution Logs</div>
                    <div className="log-viewer" style={{ flex: 1 }}>
                        {logs.map((l) => (
                            <div key={l.id} className={`log-line ${l.level}`}>
                                <span className="log-time">{formatTs(l.timestamp)}</span>
                                <span className="log-msg">{l.message}</span>
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <div className="page animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {captcha && (
                <div className="captcha-overlay">
                    <div className="captcha-modal">
                        <h2>CAPTCHA Detected</h2>
                        <p>{captcha.msg}</p>
                        {captcha.img && <img src={`data:image/jpeg;base64,${captcha.img}`} alt="captcha" style={{ width: '100%', marginBottom: 20 }} />}
                        <button className="btn btn-primary" onClick={async () => {
                            if (taskId) await window.electronAPI.overrideCaptcha(taskId);
                            setCaptcha(null);
                        }}>I've solved it</button>
                    </div>
                </div>
            )}

            {learning && (
                <div className="captcha-overlay">
                    <div className="captcha-modal">
                        <h2>Learning Complete</h2>
                        <p>{learning.reasoning}</p>
                        <button className="btn btn-primary" onClick={handleConfirmLearning}>Confirm & Execute</button>
                    </div>
                </div>
            )}

            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 className="page-title">{task.name}</h1>
                    <p className="page-subtitle">{task.domain}</p>
                </div>
                <div className="btn-row">
                    {isActive && <button className="btn btn-warning btn-sm" onClick={() => handleAction('pause')}>Pause</button>}
                    {isPaused && <button className="btn btn-secondary btn-sm" onClick={() => handleAction('resume')}>Resume</button>}
                    {(isActive || isPaused) && <button className="btn btn-danger btn-sm" onClick={() => handleAction('stop')}>Stop</button>}
                </div>
            </div>

            {viewMode === 'train' ? renderTrainUI() : renderRunUI()}
        </div>
    );
}

import React from 'react';
