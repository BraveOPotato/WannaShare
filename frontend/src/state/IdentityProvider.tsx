import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Identity } from '../types';
import { loadIdentity, saveDisplayName } from '../lib/storage';

interface IdentityContextValue {
  identity: Identity;
  rename: (displayName: string) => void;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity>(() => loadIdentity());

  const rename = useCallback((displayName: string) => {
    setIdentity(saveDisplayName(displayName));
  }, []);

  const value = useMemo(() => ({ identity, rename }), [identity, rename]);

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentity(): IdentityContextValue {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error('useIdentity must be used within IdentityProvider');
  return ctx;
}
