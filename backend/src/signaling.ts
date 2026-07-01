// Presence / short-code WebSocket server.
//
// Wires the wire-protocol messages to the registry (presence, network,
// favorites) and the code store (create / resolve). Includes a heartbeat so
// dead sockets are cleaned up.

import type { IncomingMessage } from 'node:http';
import type { WebSocket, WebSocketServer } from 'ws';
import { config } from './config';
import { CodeStore } from './codes';
import { Client, Registry } from './registry';
import type { Inbound } from './protocol';

function clientIp(req: IncomingMessage): string {
  if (config.trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    const first = Array.isArray(xff) ? xff[0] : xff?.split(',')[0];
    if (first && first.trim()) return normalizeIp(first.trim());
  }
  return normalizeIp(req.socket.remoteAddress ?? 'unknown');
}

function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/, '');
}

export function createSignalingServer(wss: WebSocketServer): void {
  const registry = new Registry();
  const codes = new CodeStore();
  const alive = new WeakMap<WebSocket, boolean>();

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const client = new Client(ws, clientIp(req));
    registry.add(client);
    alive.set(ws, true);

    ws.on('pong', () => alive.set(ws, true));

    ws.on('message', (raw) => {
      let msg: Inbound;
      try {
        msg = JSON.parse(raw.toString()) as Inbound;
      } catch {
        return;
      }
      handle(client, msg, registry, codes);
    });

    ws.on('close', () => registry.remove(client));
    ws.on('error', () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    });
  });

  // Heartbeat: drop unresponsive sockets every 30s.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      try {
        ws.ping();
      } catch {
        /* ignore */
      }
    }
  }, 30_000);

  const sweep = setInterval(() => codes.sweep(), 60_000);

  wss.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(sweep);
  });
}

function handle(client: Client, msg: Inbound, registry: Registry, codes: CodeStore): void {
  switch (msg.t) {
    case 'register':
      if (msg.deviceId && msg.peerId) {
        registry.register(client, msg.deviceId, msg.peerId, msg.displayName || 'Device');
      }
      break;

    case 'code:create': {
      if (!client.registered) {
        client.send({ t: 'error', rid: msg.rid, message: 'Register before requesting a code.' });
        break;
      }
      const { code, expiresAt } = codes.create(client.peerId!, client.deviceId!);
      client.send({ t: 'code:created', rid: msg.rid, code, expiresAt });
      break;
    }

    case 'code:resolve': {
      const peerId = codes.resolve(String(msg.code));
      if (peerId) client.send({ t: 'code:resolved', rid: msg.rid, peerId });
      else client.send({ t: 'code:notfound', rid: msg.rid });
      break;
    }

    case 'watch:network':
      registry.setNetworkWatch(client, Boolean(msg.on));
      break;

    case 'watch:favorites':
      registry.setFavorites(client, Array.isArray(msg.deviceIds) ? msg.deviceIds : []);
      break;
  }
}
