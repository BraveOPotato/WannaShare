// File transfer over a PeerJS DataConnection.
//
// Sending: read the File in CHUNK_SIZE slices, respect the data channel's
// buffered amount (backpressure) so large files don't blow up memory or stall
// the channel, and support cancellation. Reliable+ordered delivery is provided
// by the underlying SCTP data channel; the receiver sends an ack when complete.
//
// Receiving: collect chunks into a fixed-size array, then assemble a Blob and
// hand back an object URL for download.

import type { DataConnection } from 'peerjs';
import { CHUNK_SIZE, type WireFileChunk, type WireFileMeta } from './wire';

const MAX_BUFFERED = 8 * 1024 * 1024; // pause sending above 8 MiB queued

/**
 * Access the underlying RTCDataChannel defensively. PeerJS exposes it, but the
 * property's presence/typing has shifted across releases, so we read it through
 * a cast to stay compatible regardless of the installed patch version.
 */
function getChannel(conn: DataConnection): RTCDataChannel | undefined {
  return (conn as unknown as { dataChannel?: RTCDataChannel }).dataChannel;
}

function waitForDrain(conn: DataConnection): Promise<void> {
  return new Promise((resolve) => {
    const channel = getChannel(conn);
    if (!channel) {
      resolve();
      return;
    }
    channel.bufferedAmountLowThreshold = MAX_BUFFERED / 2;
    const onLow = () => {
      channel.removeEventListener('bufferedamountlow', onLow);
      resolve();
    };
    channel.addEventListener('bufferedamountlow', onLow);
    // Safety timeout in case the event doesn't fire.
    setTimeout(onLow, 400);
  });
}

export interface SendHandle {
  cancel(): void;
}

/**
 * Send a file over `conn`. Progress (0..1) is reported via `onProgress`.
 * The promise resolves once all bytes are queued; the caller marks the item
 * "sent" only after the peer's ack arrives (handled in the session layer).
 */
export function sendFile(
  conn: DataConnection,
  id: string,
  file: File,
  onProgress: (progress: number) => void,
): { promise: Promise<void>; handle: SendHandle } {
  let canceled = false;
  const handle: SendHandle = {
    cancel() {
      canceled = true;
    },
  };

  const promise = (async () => {
    const chunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
    const meta: WireFileMeta = {
      k: 'file:meta',
      id,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      chunks,
      ts: Date.now(),
    };
    conn.send(meta);

    for (let i = 0; i < chunks; i += 1) {
      if (canceled) {
        conn.send({ k: 'file:cancel', id });
        throw new DOMException('Transfer canceled', 'AbortError');
      }
      const start = i * CHUNK_SIZE;
      const slice = file.slice(start, start + CHUNK_SIZE);
      const data = await slice.arrayBuffer();

      const channel = getChannel(conn);
      if (channel && channel.bufferedAmount > MAX_BUFFERED) {
        await waitForDrain(conn);
      }

      const chunk: WireFileChunk = { k: 'file:chunk', id, i, data };
      conn.send(chunk);
      onProgress((i + 1) / chunks);
    }

    conn.send({ k: 'file:done', id });
  })();

  return { promise, handle };
}

/** Accumulates incoming chunks for one file and assembles them on completion. */
export class FileReceiver {
  readonly meta: WireFileMeta;
  private parts: (ArrayBuffer | undefined)[];
  private received = 0;

  constructor(meta: WireFileMeta) {
    this.meta = meta;
    this.parts = new Array(meta.chunks);
  }

  /** Add a chunk; returns the current progress (0..1). */
  addChunk(index: number, data: ArrayBuffer): number {
    if (index >= 0 && index < this.parts.length && this.parts[index] === undefined) {
      this.parts[index] = data;
      this.received += 1;
    }
    return this.received / this.meta.chunks;
  }

  get complete(): boolean {
    return this.received >= this.meta.chunks;
  }

  /** Build a downloadable object URL. Call once, when complete. */
  toObjectUrl(): string {
    const blob = new Blob(this.parts.filter(Boolean) as ArrayBuffer[], {
      type: this.meta.mime,
    });
    return URL.createObjectURL(blob);
  }
}
