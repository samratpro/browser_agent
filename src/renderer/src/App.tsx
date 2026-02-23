import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import TaskDetailView from './pages/TaskDetailView';
import PatternsPage from './pages/PatternsPage';
import SchedulerPage from './pages/SchedulerPage';
import LogsPage from './pages/LogsPage';
import SettingsPage from './pages/SettingsPage';

import TrainTaskPage from './pages/TrainTaskPage';
import RunningTasksPage from './pages/RunningTasksPage';

// ─── Auth Guard ───────────────────────────────────────────────

function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

// ─── Route Definitions ────────────────────────────────────────

function AppRoutes() {
    const { isAuthenticated } = useAuth();

    return (
        <Routes>
            <Route path="/login" element={
                isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
            } />

            <Route path="/" element={
                <AuthGuard>
                    <AppLayout />
                </AuthGuard>
            }>
                <Route index element={<DashboardPage />} />
                <Route path="train" element={<TrainTaskPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="tasks/:taskId" element={<TaskDetailView />} />
                <Route path="running" element={<RunningTasksPage />} />
                <Route path="patterns" element={<PatternsPage />} />
                <Route path="scheduler" element={<SchedulerPage />} />
                <Route path="logs" element={<LogsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}

// ─── App Root ─────────────────────────────────────────────────

export default function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <HashRouter>
                    <AppRoutes />
                </HashRouter>
            </AuthProvider>
        </ThemeProvider>
    );
}
