// Short 6-digit connection codes mapping to a peer id.
//
// Codes are unique, expire after a TTL, and rotate per device: creating a new
// code for a device invalidates its previous one so the space stays clean.

import { randomInt } from 'node:crypto';
import { config } from './config';

interface Entry {
  peerId: string;
  deviceId: string;
  expiresAt: number;
}

function sixDigits(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export class CodeStore {
  private byCode = new Map<string, Entry>();
  private byDevice = new Map<string, string>();

  create(peerId: string, deviceId: string): { code: string; expiresAt: number } {
    const previous = this.byDevice.get(deviceId);
    if (previous) this.byCode.delete(previous);

    let code = sixDigits();
    let guard = 0;
    while (this.byCode.has(code) && guard < 50) {
      code = sixDigits();
      guard += 1;
    }

    const expiresAt = Date.now() + config.codeTtlMs;
    this.byCode.set(code, { peerId, deviceId, expiresAt });
    this.byDevice.set(deviceId, code);
    return { code, expiresAt };
  }

  resolve(code: string): string | null {
    const entry = this.byCode.get(code);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.byCode.delete(code);
      this.byDevice.delete(entry.deviceId);
      return null;
    }
    return entry.peerId;
  }

  /** Drop expired codes; call on an interval. */
  sweep(): void {
    const now = Date.now();
    for (const [code, entry] of this.byCode) {
      if (entry.expiresAt < now) {
        this.byCode.delete(code);
        this.byDevice.delete(entry.deviceId);
      }
    }
  }
}
