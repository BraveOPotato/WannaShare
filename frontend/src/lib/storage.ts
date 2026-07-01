// A thin, typed wrapper over localStorage. All persistence lives here so the
// storage schema is easy to find and evolve. Chat history is intentionally
// NOT persisted — sessions are ephemeral by design.

import type { Favorite, IceServer, Identity, ThemeSetting } from '../types';
import { generateDeviceId, generateDisplayName } from './random';

const KEYS = {
  identity: 'wannasend.identity.v1',
  theme: 'wannasend.theme.v1',
  ice: 'wannasend.ice.v1',
  favorites: 'wannasend.favorites.v1',
} as const;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

// --- Identity --------------------------------------------------------------

/** Load the persisted identity, creating one on first run. */
export function loadIdentity(): Identity {
  const existing = read<Identity>(KEYS.identity);
  if (existing?.deviceId && existing.displayName) return existing;
  const created: Identity = {
    deviceId: generateDeviceId(),
    displayName: generateDisplayName(),
  };
  write(KEYS.identity, created);
  return created;
}

export function saveDisplayName(displayName: string): Identity {
  const current = loadIdentity();
  const next: Identity = { ...current, displayName: displayName.trim() || current.displayName };
  write(KEYS.identity, next);
  return next;
}

// --- Theme -----------------------------------------------------------------

export function loadTheme(): ThemeSetting {
  return read<ThemeSetting>(KEYS.theme) ?? 'system';
}
export function saveTheme(theme: ThemeSetting): void {
  write(KEYS.theme, theme);
}

// --- Custom ICE servers ----------------------------------------------------

export function loadCustomIceServers(): IceServer[] | null {
  return read<IceServer[]>(KEYS.ice);
}
export function saveCustomIceServers(servers: IceServer[]): void {
  write(KEYS.ice, servers);
}
export function clearCustomIceServers(): void {
  try {
    localStorage.removeItem(KEYS.ice);
  } catch {
    /* ignore */
  }
}

// --- Favorites -------------------------------------------------------------

export function loadFavorites(): Favorite[] {
  return read<Favorite[]>(KEYS.favorites) ?? [];
}
export function saveFavorites(favorites: Favorite[]): void {
  write(KEYS.favorites, favorites);
}
