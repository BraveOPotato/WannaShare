// Wire protocol for the presence/coordination WebSocket.
// This mirrors frontend/src/lib/signalingClient.ts — keep the two in sync.

/** A reachable device advertised to a client. */
export interface RemoteDevice {
  deviceId: string;
  peerId: string;
  displayName: string;
}

// --- Client -> Server ------------------------------------------------------

export interface InRegister {
  t: 'register';
  deviceId: string;
  peerId: string;
  displayName: string;
}
export interface InCodeCreate { t: 'code:create'; rid: string }
export interface InCodeResolve { t: 'code:resolve'; rid: string; code: string }
export interface InWatchNetwork { t: 'watch:network'; on: boolean }
export interface InWatchFavorites { t: 'watch:favorites'; deviceIds: string[] }

export type Inbound =
  | InRegister
  | InCodeCreate
  | InCodeResolve
  | InWatchNetwork
  | InWatchFavorites;

// --- Server -> Client ------------------------------------------------------

export interface OutRegistered { t: 'registered'; peerId: string }
export interface OutCodeCreated { t: 'code:created'; rid: string; code: string; expiresAt: number }
export interface OutCodeResolved { t: 'code:resolved'; rid: string; peerId: string }
export interface OutCodeNotFound { t: 'code:notfound'; rid: string }
export interface OutNetwork { t: 'network'; devices: RemoteDevice[] }
export interface OutFavorites { t: 'favorites'; devices: RemoteDevice[] }
export interface OutError { t: 'error'; rid?: string; message: string }

export type Outbound =
  | OutRegistered
  | OutCodeCreated
  | OutCodeResolved
  | OutCodeNotFound
  | OutNetwork
  | OutFavorites
  | OutError;
