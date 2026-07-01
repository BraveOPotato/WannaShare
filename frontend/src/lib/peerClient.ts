// Thin factory around PeerJS `Peer`.
//
// We let the PeerServer assign a fresh (opaque) peer id every session; our
// *stable* identity is the localStorage deviceId, mapped to the current peer
// id by the coordination server. ICE servers come from user settings (falling
// back to build defaults). We deliberately leave iceTransportPolicy at its
// default ("all") so WebRTC prefers direct/host/srflx candidates and only
// relays through TURN when a direct path can't be established.

import { Peer } from 'peerjs';
import { peerServerConfig, resolveIceServers } from '../config';
import type { IceServer } from '../types';

export interface DialMetadata {
  deviceId: string;
  displayName: string;
}

export function createPeer(): Peer {
  const iceServers = resolveIceServers() as RTCIceServer[];
  return new Peer({
    host: peerServerConfig.host,
    port: peerServerConfig.port,
    path: peerServerConfig.path,
    secure: peerServerConfig.secure,
    config: {
      iceServers,
      // iceTransportPolicy intentionally omitted -> "all" (TURN last resort).
    },
  });
}

/** Exposed so the settings UI can preview what will be used. */
export function currentIceServers(): IceServer[] {
  return resolveIceServers();
}
