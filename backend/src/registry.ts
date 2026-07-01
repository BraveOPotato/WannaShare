// In-memory presence registry.
//
// Every WebSocket connection is one Client. Once a client registers (announces
// its stable deviceId + current peerId), it becomes discoverable:
//   - to other clients on the same public IP ("On this network")
//   - to clients that list its deviceId among their favorites
//
// Any presence change re-pushes the relevant views to interested watchers.
// Sizes here are tiny (personal use), so simple full recomputes are fine.

import type { WebSocket } from 'ws';
import type { Outbound, RemoteDevice } from './protocol';

export class Client {
  ip: string;
  deviceId?: string;
  peerId?: string;
  displayName?: string;
  watchNetwork = false;
  favorites = new Set<string>();

  constructor(private ws: WebSocket, ip: string) {
    this.ip = ip;
  }

  get registered(): boolean {
    return Boolean(this.deviceId && this.peerId);
  }

  toRemote(): RemoteDevice | null {
    if (!this.deviceId || !this.peerId) return null;
    return { deviceId: this.deviceId, peerId: this.peerId, displayName: this.displayName ?? 'Device' };
  }

  send(message: Outbound): void {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

export class Registry {
  private clients = new Set<Client>();

  add(client: Client): void {
    this.clients.add(client);
  }

  remove(client: Client): void {
    this.clients.delete(client);
    this.broadcastPresence();
  }

  register(client: Client, deviceId: string, peerId: string, displayName: string): void {
    client.deviceId = deviceId;
    client.peerId = peerId;
    client.displayName = displayName;
    client.send({ t: 'registered', peerId });
    this.broadcastPresence();
  }

  setNetworkWatch(client: Client, on: boolean): void {
    client.watchNetwork = on;
    if (on) client.send({ t: 'network', devices: this.networkFor(client) });
  }

  setFavorites(client: Client, deviceIds: string[]): void {
    client.favorites = new Set(deviceIds);
    client.send({ t: 'favorites', devices: this.favoritesFor(client) });
  }

  /** Registered peers sharing this client's public IP (excluding itself). */
  private networkFor(client: Client): RemoteDevice[] {
    const out: RemoteDevice[] = [];
    for (const other of this.clients) {
      if (other === client || other.ip !== client.ip) continue;
      const remote = other.toRemote();
      if (remote) out.push(remote);
    }
    return out;
  }

  /** Registered peers among this client's favorites (deduped by deviceId). */
  private favoritesFor(client: Client): RemoteDevice[] {
    if (client.favorites.size === 0) return [];
    const seen = new Set<string>();
    const out: RemoteDevice[] = [];
    for (const other of this.clients) {
      if (other === client || !other.deviceId) continue;
      if (!client.favorites.has(other.deviceId) || seen.has(other.deviceId)) continue;
      const remote = other.toRemote();
      if (remote) {
        seen.add(other.deviceId);
        out.push(remote);
      }
    }
    return out;
  }

  /** Re-push network + favorites views to every watcher. */
  private broadcastPresence(): void {
    for (const client of this.clients) {
      if (client.watchNetwork) client.send({ t: 'network', devices: this.networkFor(client) });
      if (client.favorites.size > 0) client.send({ t: 'favorites', devices: this.favoritesFor(client) });
    }
  }
}
