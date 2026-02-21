import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: 'dark',
    toggleTheme: () => { },
    setTheme: () => { },
});

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark');

    useEffect(() => {
        // Load persisted theme
        const load = async () => {
            let saved: string | null = null;
            if (window.electronAPI) {
                saved = await window.electronAPI.dbGet('theme').catch(() => null);
            } else {
                saved = localStorage.getItem('theme');
            }
            if (saved === 'light' || saved === 'dark') {
                applyTheme(saved);
                setThemeState(saved);
            }
        };
        load();
    }, []);

    const applyTheme = (t: Theme) => {
        document.documentElement.setAttribute('data-theme', t);
    };

    const setTheme = (t: Theme) => {
        applyTheme(t);
        setThemeState(t);
        if (window.electronAPI) {
            window.electronAPI.dbSet('theme', t);
        } else {
            localStorage.setItem('theme', t);
        }
    };

    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
