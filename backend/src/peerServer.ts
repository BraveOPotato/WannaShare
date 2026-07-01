// Mounts the PeerJS signaling broker (offer/answer/ICE relay for WebRTC).
//
// The client connects with { host, port, path } where `path` === config.peerPath.
// We mount at root with the broker's own path option so the effective client
// path is exactly config.peerPath.

import type { Express } from 'express';
import type { Server } from 'node:http';
import { ExpressPeerServer } from 'peer';
import { config } from './config';

export function mountPeerServer(app: Express, server: Server) {
  const peerServer = ExpressPeerServer(server, {
    path: config.peerPath,
    allow_discovery: false,
  });
  app.use('/', peerServer);
  return peerServer;
}
