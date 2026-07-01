import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { IceServer } from '../types';
import { defaultIceServers } from '../config';
import {
  clearCustomIceServers,
  loadCustomIceServers,
  saveCustomIceServers,
} from '../lib/storage';

interface SettingsContextValue {
  /** User-defined ICE servers, or null when using defaults. */
  customIceServers: IceServer[] | null;
  /** What WebRTC will actually use (custom if set, else defaults). */
  effectiveIceServers: IceServer[];
  saveIceServers: (servers: IceServer[]) => void;
  resetIceServers: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [custom, setCustom] = useState<IceServer[] | null>(() => loadCustomIceServers());

  const saveIceServers = useCallback((servers: IceServer[]) => {
    const cleaned = servers.filter((s) => {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      return urls.some((u) => u.trim().length > 0);
    });
    if (cleaned.length === 0) {
      clearCustomIceServers();
      setCustom(null);
      return;
    }
    saveCustomIceServers(cleaned);
    setCustom(cleaned);
  }, []);

  const resetIceServers = useCallback(() => {
    clearCustomIceServers();
    setCustom(null);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      customIceServers: custom,
      effectiveIceServers: custom && custom.length > 0 ? custom : defaultIceServers(),
      saveIceServers,
      resetIceServers,
    }),
    [custom, saveIceServers, resetIceServers],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
