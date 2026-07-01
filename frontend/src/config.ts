import type { IceServer } from './types';
import { loadCustomIceServers } from './lib/storage';

/** Options for constructing a PeerJS `Peer`. */
export interface PeerServerConfig {
  host: string;
  port: number;
  path: string;
  secure: boolean;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  return value === 'true' || value === '1';
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && value ? n : fallback;
}

function csv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const peerServerConfig: PeerServerConfig = {
  host: import.meta.env.VITE_PEER_HOST || 'localhost',
  port: num(import.meta.env.VITE_PEER_PORT, 9000),
  path: import.meta.env.VITE_PEER_PATH || '/peerjs',
  secure: bool(import.meta.env.VITE_PEER_SECURE, false),
};

export const signalingUrl: string =
  import.meta.env.VITE_SIGNALING_URL || 'ws://localhost:9001/ws';

/** The public origin embedded into QR codes for camera deep-linking. */
export const publicAppUrl: string =
  import.meta.env.VITE_PUBLIC_APP_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

/** ICE servers as configured at build time (the fallback defaults). */
export function defaultIceServers(): IceServer[] {
  const servers: IceServer[] = [];

  for (const urls of csv(import.meta.env.VITE_STUN_URLS)) {
    servers.push({ urls });
  }

  const turnUrls = csv(import.meta.env.VITE_TURN_URLS);
  if (turnUrls.length > 0) {
    servers.push({
      urls: turnUrls,
      username: import.meta.env.VITE_TURN_USERNAME || undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL || undefined,
    });
  }

  // Always keep a public STUN server as a safety net for discovery.
  if (servers.length === 0) {
    servers.push({ urls: 'stun:stun.l.google.com:19302' });
  }
  return servers;
}

/**
 * The ICE servers actually used: a user's saved custom list wins over the
 * built-in defaults. TURN relay is only *used* when direct P2P fails —
 * we never force `iceTransportPolicy: 'relay'`.
 */
export function resolveIceServers(): IceServer[] {
  const custom = loadCustomIceServers();
  return custom && custom.length > 0 ? custom : defaultIceServers();
}
