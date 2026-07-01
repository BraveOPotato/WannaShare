// WannaSend backend entrypoint.
//
// Two listeners in one process:
//   :PORT        Express — PeerJS broker (WebRTC signaling) + /health
//   :SIGNAL_PORT presence / short-code WebSocket (/ws)
//
// They are deliberately on separate ports: multiple WebSocket servers sharing
// one HTTP server's "upgrade" event fight over non-matching paths. Behind a
// reverse proxy you can route both under a single public hostname.

import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { config } from './config';
import { mountPeerServer } from './peerServer';
import { createSignalingServer } from './signaling';

// --- PeerJS broker + health (config.port) --------------------------------
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', config.allowOrigin);
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'wannasend', ts: Date.now() });
});

const peerHttp = createServer(app);
mountPeerServer(app, peerHttp);
peerHttp.listen(config.port, () => {
  console.log(`[wannasend] PeerJS broker + HTTP listening on :${config.port} (path ${config.peerPath})`);
});

// --- Presence / short-code WebSocket (config.signalPort) -----------------
const signalHttp = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(426, { 'content-type': 'text/plain' });
  res.end('Upgrade required');
});

const wss = new WebSocketServer({ server: signalHttp, path: config.wsPath });
createSignalingServer(wss);

signalHttp.listen(config.signalPort, () => {
  console.log(`[wannasend] presence WebSocket listening on :${config.signalPort} (path ${config.wsPath})`);
});

// --- Graceful shutdown ----------------------------------------------------
function shutdown() {
  console.log('[wannasend] shutting down…');
  wss.close();
  peerHttp.close();
  signalHttp.close();
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
