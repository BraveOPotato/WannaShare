import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ThemeSetting } from '../types';
import { loadTheme, saveTheme } from '../lib/storage';

interface ThemeContextValue {
  setting: ThemeSetting;
  /** The theme actually applied right now. */
  effective: 'light' | 'dark';
  setTheme: (setting: ThemeSetting) => void;
  /** Convenience toggle used by the header button. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [setting, setSetting] = useState<ThemeSetting>(() => loadTheme());
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  // Track OS preference while on "system".
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const effective: 'light' | 'dark' =
    setting === 'system' ? (systemDark ? 'dark' : 'light') : setting;

  // Reflect onto the document so tokens switch.
  useEffect(() => {
    document.documentElement.dataset.theme = effective;
  }, [effective]);

  const setTheme = useCallback((next: ThemeSetting) => {
    setSetting(next);
    saveTheme(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(effective === 'dark' ? 'light' : 'dark');
  }, [effective, setTheme]);

  const value = useMemo(
    () => ({ setting, effective, setTheme, toggle }),
    [setting, effective, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
