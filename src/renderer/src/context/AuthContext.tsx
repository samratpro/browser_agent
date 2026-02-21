import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { checkExpirationStatus } from './CheckExpire';

interface AuthContextValue {
    isAuthenticated: boolean;
    user: string | null;
    login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
    isAuthenticated: false,
    user: null,
    login: async () => ({ success: false }),
    logout: () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<string | null>(null);

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.dbGet('user').then((saved) => {
                if (saved) setUser(saved);
            }).catch(() => { });
        } else {
            setUser(sessionStorage.getItem('user'));
        }
    }, []);

    const login = async (username: string, password: string): Promise<{ success: boolean; message?: string }> => {
        console.log('[Auth] Login attempt for:', username);

        // 1. Check credentials
        if (username === 'admin' && password === 'admin') {
            console.log('[Auth] Credentials valid. Checking expiration...');

            // 2. Expiration check (Beta Lock)
            const expiration = await checkExpirationStatus();
            console.log('[Auth] Expiration result:', expiration);

            if (expiration.isExpired) {
                console.warn('[Auth] Access denied: expired.');
                return { success: false, message: expiration.message };
            }

            // 3. Complete login
            console.log('[Auth] Expiration passed. Logging in...');
            setUser(username);
            if (window.electronAPI) {
                window.electronAPI.dbSet('user', username);
            } else {
                sessionStorage.setItem('user', username);
            }
            return { success: true };
        }

        return { success: false, message: 'Invalid credentials.' };
    };

    const logout = () => {
        setUser(null);
        if (window.electronAPI) {
            window.electronAPI.dbSet('user', null);
        } else {
            sessionStorage.removeItem('user');
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated: !!user, user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
