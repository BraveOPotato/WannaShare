// The application-level protocol spoken over a PeerJS DataConnection.
// PeerJS binary serialization (BinaryPack) carries these objects, including
// the ArrayBuffer chunk payloads.

export interface WireHello {
  k: 'hello';
  deviceId: string;
  displayName: string;
}

export interface WireChat {
  k: 'chat';
  id: string;
  text: string;
  ts: number;
}

export interface WireFileMeta {
  k: 'file:meta';
  id: string;
  name: string;
  size: number;
  mime: string;
  chunks: number;
  ts: number;
}

export interface WireFileChunk {
  k: 'file:chunk';
  id: string;
  i: number;
  data: ArrayBuffer;
}

export interface WireFileDone { k: 'file:done'; id: string }
export interface WireFileAck { k: 'file:ack'; id: string }
export interface WireFileCancel { k: 'file:cancel'; id: string }

export type WireMessage =
  | WireHello
  | WireChat
  | WireFileMeta
  | WireFileChunk
  | WireFileDone
  | WireFileAck
  | WireFileCancel;

/** Bytes per data-channel message. 16 KiB is the safe cross-browser SCTP max. */
export const CHUNK_SIZE = 16 * 1024;
