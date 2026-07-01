import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Favorite } from '../types';
import { loadFavorites, saveFavorites } from '../lib/storage';

interface FavoritesContextValue {
  favorites: Favorite[];
  isFavorite: (deviceId: string) => boolean;
  getFavorite: (deviceId: string) => Favorite | undefined;
  /** Add or update a contact (starring). */
  upsert: (deviceId: string, displayName: string) => void;
  remove: (deviceId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Favorite[]>(() => loadFavorites());

  const persist = useCallback((next: Favorite[]) => {
    setFavorites(next);
    saveFavorites(next);
  }, []);

  const isFavorite = useCallback(
    (deviceId: string) => favorites.some((f) => f.deviceId === deviceId),
    [favorites],
  );

  const getFavorite = useCallback(
    (deviceId: string) => favorites.find((f) => f.deviceId === deviceId),
    [favorites],
  );

  const upsert = useCallback(
    (deviceId: string, displayName: string) => {
      const name = displayName.trim();
      if (!deviceId || !name) return;
      const existing = favorites.find((f) => f.deviceId === deviceId);
      const next = existing
        ? favorites.map((f) => (f.deviceId === deviceId ? { ...f, displayName: name } : f))
        : [...favorites, { deviceId, displayName: name, addedAt: Date.now() }];
      persist(next);
    },
    [favorites, persist],
  );

  const remove = useCallback(
    (deviceId: string) => persist(favorites.filter((f) => f.deviceId !== deviceId)),
    [favorites, persist],
  );

  const value = useMemo(
    () => ({ favorites, isFavorite, getFavorite, upsert, remove }),
    [favorites, isFavorite, getFavorite, upsert, remove],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
