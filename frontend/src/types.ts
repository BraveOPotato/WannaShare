// Central type definitions shared across the app.

/** A stable, per-device identity persisted in localStorage. */
export interface Identity {
  /** Stable id that survives display-name changes and reconnects. */
  deviceId: string;
  /** Human-friendly, user-editable label (e.g. "cheery-bird-2342"). */
  displayName: string;
}

/** A single ICE server entry passed to WebRTC / PeerJS. */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** A saved contact. Matched across sessions by `deviceId`. */
export interface Favorite {
  /** The contact's stable device id. */
  deviceId: string;
  /** Name the local user chose for this contact when starring it. */
  displayName: string;
  addedAt: number;
}

/** A device the coordination server reports as reachable. */
export interface RemoteDevice {
  deviceId: string;
  /** The device's current (session) peer id, used to dial it. */
  peerId: string;
  /** The device's own self-reported display name. */
  displayName: string;
}

/** Theme options; "system" follows the OS preference. */
export type ThemeSetting = 'light' | 'dark' | 'system';

// --- Chat / transfer models ------------------------------------------------

export type Direction = 'in' | 'out';

/** Delivery state for an outgoing item, mirrored in the UI (✓✓ / ✗ / …). */
export type DeliveryState =
  | 'sending'
  | 'sent'
  | 'failed'
  | 'canceled'
  | 'received'; // used for incoming items

export interface TextMessage {
  type: 'text';
  id: string;
  direction: Direction;
  text: string;
  ts: number;
  state: DeliveryState;
}

export interface FileMessage {
  type: 'file';
  id: string;
  direction: Direction;
  name: string;
  size: number;
  mime: string;
  ts: number;
  state: DeliveryState;
  /** 0..1 transfer progress. */
  progress: number;
  /** Object URL for a fully-received/-sent file, ready for download. */
  url?: string;
}

export type ChatItem = TextMessage | FileMessage;

/** The lifecycle of the single active peer session. */
export type SessionPhase =
  | 'idle' // no session
  | 'listening' // waiting to be dialed (Send screen)
  | 'incoming' // a request modal is showing
  | 'dialing' // we called someone, awaiting accept
  | 'connected' // chat is open
  | 'closed'; // last session ended
