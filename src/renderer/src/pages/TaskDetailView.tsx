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

    const loadTask = async () => {
        if (!taskId) return;
        const all = (await window.electronAPI.getTasks()) as Task[];
        const found = all.find((t) => t.id === taskId);
        if (found) setTask(found);
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

    const handleInterrupt = async () => {
        if (!taskId || !interruptMsg.trim()) return;
        setSendingInterrupt(true);
        try {
            await window.electronAPI.interruptTask(taskId, interruptMsg.trim());
            setInterruptMsg('');
        } finally {
            setSendingInterrupt(false);
        }
    };

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

    return (
        <div className="page animate-fade-in">
            {/* CAPTCHA Overlay */}
            {captcha && (
                <div className="captcha-overlay">
                    <div className="captcha-modal">
                        <div style={{ fontSize: 32, marginBottom: 12 }}>🛡️</div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>CAPTCHA Detected</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>{captcha.msg}</p>
                        {captcha.img && (
                            <img src={`data:image/jpeg;base64,${captcha.img}`} alt="CAPTCHA screenshot"
                                style={{ width: '100%', borderRadius: 'var(--radius-md)', marginBottom: 20 }} />
                        )}
                        <button className="btn btn-primary" onClick={async () => {
                            if (taskId) await window.electronAPI.overrideCaptcha(taskId);
                            setCaptcha(null);
                        }}>
                            ✓ I've solved the CAPTCHA — Continue
                        </button>
                    </div>
                </div>
            )}

            {/* Learning Confirmation Overlay */}
            {learning && (
                <div className="captcha-overlay">
                    <div className="captcha-modal" style={{ maxWidth: 560 }}>
                        <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Pattern Learning Complete</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                            {learning.reasoning ?? 'The AI has learned the page structure and created an action plan.'}
                        </p>
                        <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', padding: 12, marginBottom: 20, textAlign: 'left' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                                Planned Actions ({(learning.actions as unknown[]).length})
                            </div>
                            {(learning.actions as Array<{ type: string; selector?: string; url?: string }>).slice(0, 8).map((a, i) => (
                                <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '3px 0', fontFamily: 'var(--font-mono)' }}>
                                    {i + 1}. {a.type}{a.selector ? ` → ${a.selector.slice(0, 40)}` : ''}{a.url ? ` → ${a.url.slice(0, 40)}` : ''}
                                </div>
                            ))}
                            {learning.actions.length > 8 && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>... and {learning.actions.length - 8} more</div>
                            )}
                        </div>
                        <div className="btn-row" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-primary" onClick={handleConfirmLearning}>✓ Confirm & Execute</button>
                            <button className="btn btn-danger" onClick={async () => {
                                if (taskId) await window.electronAPI.stopTask(taskId);
                                setLearning(null);
                            }}>✕ Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <button onClick={() => navigate('/tasks')} className="btn btn-secondary btn-sm" style={{ marginBottom: 8 }}>
                        ← Back to Tasks
                    </button>
                    <h1 className="page-title" style={{ fontSize: 18 }}>{task.name}</h1>
                    <p className="page-subtitle">{task.domain}</p>
                </div>
                <div className="btn-row">
                    {isActive && <button className="btn btn-warning btn-sm" onClick={() => handleAction('pause')}>⏸ Pause</button>}
                    {isPaused && <button className="btn btn-secondary btn-sm" onClick={() => handleAction('resume')} style={{ color: 'var(--success)' }}>▶ Resume</button>}
                    {(isActive || isPaused) && <button className="btn btn-danger btn-sm" onClick={() => handleAction('stop')}>⬛ Stop</button>}
                </div>
            </div>

            {/* State Timeline */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title" style={{ marginBottom: 14 }}>State Timeline</div>
                <div className="state-timeline">
                    {STATES_ORDERED.map((s, i) => (
                        <>
                            {i > 0 && (
                                <div key={`c-${i}`} className={`timeline-connector ${i <= currentStateIdx ? 'done' : ''}`} />
                            )}
                            <div key={s} className="timeline-step">
                                <div className={`timeline-dot ${s === task.state ? 'active' : i < currentStateIdx ? 'done' : ''}`}>
                                    {i < currentStateIdx ? '✓' : i + 1}
                                </div>
                                <div className="timeline-label">{s}</div>
                            </div>
                        </>
                    ))}
                </div>
                {task.errorMessage && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--danger-dim)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--danger)' }}>
                        {task.errorMessage}
                    </div>
                )}
            </div>

            {/* Two-column: Screenshot + Logs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Live Screenshot */}
                <div className="card">
                    <div className="card-title" style={{ marginBottom: 12 }}>Live Browser</div>
                    <div className="screenshot-viewer">
                        {screenshot
                            ? <img src={`data:image/jpeg;base64,${screenshot}`} alt="Live browser view" />
                            : <div className="screenshot-placeholder">
                                <div style={{ fontSize: 24, marginBottom: 8 }}>🖥️</div>
                                <div>Browser view will appear here</div>
                            </div>
                        }
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {task.state === AgentState.EXECUTING ? '● Live' : '○ Idle'} · {task.domain}
                    </div>
                </div>

                {/* Execution Logs */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="card-header">
                        <span className="card-title">Execution Logs</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {logs.length} lines
                        </span>
                    </div>
                    <div className="log-viewer" style={{ flex: 1 }}>
                        {!logs.length && (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No logs yet</div>
                        )}
                        {logs.map((l) => (
                            <div key={l.id} className={`log-line ${l.level}`}>
                                <span className="log-time">{formatTs(l.timestamp)}</span>
                                <span className="log-level">{l.level.toUpperCase()}</span>
                                <span className="log-msg">{l.message}</span>
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </div>

            {/* Extracted Data */}
            {task.extractedData && (task.extractedData as unknown[]).length > 0 && (
                <div className="card" style={{ marginTop: 20 }}>
                    <div className="card-header">
                        <span className="card-title">Extracted Data</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {(task.extractedData as unknown[]).length} records
                        </span>
                    </div>
                    <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                        <table>
                            <thead>
                                <tr>
                                    {task.extractedData[0] && Object.keys(task.extractedData[0] as object).map((k) => (
                                        <th key={k}>{k}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(task.extractedData as Record<string, string>[]).slice(0, 50).map((row, i) => (
                                    <tr key={i}>
                                        {Object.values(row).map((v, j) => (
                                            <td key={j} style={{ maxWidth: 200 }} className="truncate">{String(v)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
