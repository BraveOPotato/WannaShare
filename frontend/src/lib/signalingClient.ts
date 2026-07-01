// Client for the coordination server (see /backend/src/signaling.ts).
//
// Responsibilities:
//  - announce our presence (deviceId + current peerId + displayName)
//  - create / resolve short 6-digit connection codes
//  - subscribe to "on this network" peers (grouped by public IP server-side)
//  - subscribe to presence of our favorite deviceIds (so we can dial them)
//
// It transparently reconnects and re-applies the last-known subscriptions.

import type { RemoteDevice } from '../types';

// --- Wire protocol (mirrors backend/src/protocol.ts) -----------------------

interface OutRegister { t: 'register'; deviceId: string; peerId: string; displayName: string }
interface OutCodeCreate { t: 'code:create'; rid: string }
interface OutCodeResolve { t: 'code:resolve'; rid: string; code: string }
interface OutWatchNetwork { t: 'watch:network'; on: boolean }
interface OutWatchFavorites { t: 'watch:favorites'; deviceIds: string[] }
type Outbound =
  | OutRegister | OutCodeCreate | OutCodeResolve | OutWatchNetwork | OutWatchFavorites;

interface InRegistered { t: 'registered'; peerId: string }
interface InCodeCreated { t: 'code:created'; rid: string; code: string; expiresAt: number }
interface InCodeResolved { t: 'code:resolved'; rid: string; peerId: string }
interface InCodeNotFound { t: 'code:notfound'; rid: string }
interface InNetwork { t: 'network'; devices: RemoteDevice[] }
interface InFavorites { t: 'favorites'; devices: RemoteDevice[] }
interface InError { t: 'error'; rid?: string; message: string }
type Inbound =
  | InRegistered | InCodeCreated | InCodeResolved | InCodeNotFound
  | InNetwork | InFavorites | InError;

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

interface Handlers {
  network: (devices: RemoteDevice[]) => void;
  favorites: (devices: RemoteDevice[]) => void;
  status: (status: ConnectionStatus) => void;
}

let ridCounter = 0;
const nextRid = () => `r${++ridCounter}`;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Partial<Handlers> = {};
  private closedByUser = false;
  private reconnectDelay = 500;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Last-known state, replayed on reconnect.
  private identity: { deviceId: string; peerId: string; displayName: string } | null = null;
  private watchingNetwork = false;
  private favoriteIds: string[] = [];

  // Pending request/response resolvers keyed by rid.
  private pending = new Map<string, (value: unknown) => void>();

  constructor(url: string) {
    this.url = url;
  }

  on<K extends keyof Handlers>(event: K, handler: Handlers[K]): void {
    this.handlers[event] = handler;
  }

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  /** Announce/refresh presence. Safe to call repeatedly (e.g. on name change). */
  register(deviceId: string, peerId: string, displayName: string): void {
    this.identity = { deviceId, peerId, displayName };
    this.send({ t: 'register', deviceId, peerId, displayName });
  }

  createCode(): Promise<{ code: string; expiresAt: number }> {
    const rid = nextRid();
    return this.request(rid, { t: 'code:create', rid }) as Promise<{ code: string; expiresAt: number }>;
  }

  /** Resolve a 6-digit code to a peerId, or null if unknown/expired. */
  async resolveCode(code: string): Promise<string | null> {
    const rid = nextRid();
    const result = (await this.request(rid, { t: 'code:resolve', rid, code })) as
      | { peerId: string }
      | null;
    return result?.peerId ?? null;
  }

  watchNetwork(on: boolean): void {
    this.watchingNetwork = on;
    this.send({ t: 'watch:network', on });
  }

  watchFavorites(deviceIds: string[]): void {
    this.favoriteIds = deviceIds;
    this.send({ t: 'watch:favorites', deviceIds });
  }

  // --- internals -----------------------------------------------------------

  private open(): void {
    this.handlers.status?.('connecting');
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.addEventListener('open', () => {
      this.reconnectDelay = 500;
      this.handlers.status?.('online');
      // Replay state so the server rebuilds our context after a drop.
      if (this.identity) {
        this.send({ t: 'register', ...this.identity });
      }
      if (this.watchingNetwork) this.send({ t: 'watch:network', on: true });
      if (this.favoriteIds.length) this.send({ t: 'watch:favorites', deviceIds: this.favoriteIds });
    });

    this.ws.addEventListener('message', (ev) => this.handleMessage(ev.data));

    this.ws.addEventListener('close', () => {
      this.handlers.status?.('offline');
      this.rejectAllPending();
      if (!this.closedByUser) this.scheduleReconnect();
    });

    this.ws.addEventListener('error', () => {
      this.ws?.close();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.7, 8000);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private send(message: Outbound): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private request(rid: string, message: Outbound): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Coordination server is offline.'));
        return;
      }
      const timeout = setTimeout(() => {
        this.pending.delete(rid);
        reject(new Error('Request timed out.'));
      }, 8000);
      this.pending.set(rid, (value) => {
        clearTimeout(timeout);
        resolve(value);
      });
      this.send(message);
    });
  }

  private resolvePending(rid: string, value: unknown): void {
    const resolver = this.pending.get(rid);
    if (resolver) {
      this.pending.delete(rid);
      resolver(value);
    }
  }

  private rejectAllPending(): void {
    // Resolve as failures by resolving with null; callers treat null as "unknown".
    for (const [, resolver] of this.pending) resolver(null);
    this.pending.clear();
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let msg: Inbound;
    try {
      msg = JSON.parse(raw) as Inbound;
    } catch {
      return;
    }
    switch (msg.t) {
      case 'code:created':
        this.resolvePending(msg.rid, { code: msg.code, expiresAt: msg.expiresAt });
        break;
      case 'code:resolved':
        this.resolvePending(msg.rid, { peerId: msg.peerId });
        break;
      case 'code:notfound':
        this.resolvePending(msg.rid, null);
        break;
      case 'network':
        this.handlers.network?.(msg.devices);
        break;
      case 'favorites':
        this.handlers.favorites?.(msg.devices);
        break;
      case 'error':
        if (msg.rid) this.resolvePending(msg.rid, null);
        break;
      case 'registered':
        // no-op; peerId is authoritative on the client.
        break;
    }
  }
}
