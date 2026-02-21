import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useTheme } from '../context/ThemeContext';

export default function AppLayout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { theme, toggleTheme } = useTheme();

    useEffect(() => {
        const handleResize = () => {
            // Some dev tools or scripts might update title with "width x height"
            // We forcefully reset it to keep the UI clean.
            if (document.title !== 'AI Browser Agent') {
                document.title = 'AI Browser Agent';
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
            {/* Custom Titlebar */}
            <div className="titlebar">
                <div style={{ flex: 1 }} />
                <span className="titlebar-title">AI Browser Agent</span>
                <div className="titlebar-buttons">
                    <button
                        className="titlebar-btn"
                        style={{ background: 'var(--text-muted)', fontSize: 10 }}
                        onClick={toggleTheme}
                        title={`${theme === 'dark' ? 'Light' : 'Dark'} mode`}
                    >
                        {theme === 'dark' ? '☀' : '☾'}
                    </button>
                    <button className="titlebar-btn minimize" onClick={() => window.electronAPI?.windowMinimize()} />
                    <button className="titlebar-btn maximize" onClick={() => window.electronAPI?.windowMaximize()} />
                    <button className="titlebar-btn close" onClick={() => window.electronAPI?.windowClose()} />
                </div>
            </div>

            {/* Sidebar + Content */}
            <div className="app-layout">
                <Sidebar
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed((v) => !v)}
                />
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
