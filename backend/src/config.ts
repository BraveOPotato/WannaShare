// Backend configuration, read once from the environment.

function int(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && value ? n : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === '') return fallback;
  return value === 'true' || value === '1';
}

export const config = {
  /** Port for the PeerJS broker + HTTP health endpoint. */
  port: int(process.env.PORT, 9000),
  /** Separate port for the presence / short-code WebSocket. */
  signalPort: int(process.env.SIGNAL_PORT, 9001),

  /** PeerJS mount path; must match the frontend's VITE_PEER_PATH. */
  peerPath: process.env.PEER_PATH || '/peerjs',
  /** Presence WebSocket path; must match the tail of VITE_SIGNALING_URL. */
  wsPath: process.env.WS_PATH || '/ws',

  /**
   * Trust X-Forwarded-For for the client's public IP. Enable only when running
   * behind a reverse proxy you control (nginx, Caddy, Cloudflare Tunnel, …).
   */
  trustProxy: bool(process.env.TRUST_PROXY, false),

  /** How long a generated connection code stays valid. */
  codeTtlMs: int(process.env.CODE_TTL_MS, 10 * 60 * 1000),

  /** CORS origin allowed to reach the PeerJS HTTP endpoints. */
  allowOrigin: process.env.ALLOW_ORIGIN || '*',
} as const;
