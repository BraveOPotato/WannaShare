// QR generation (qrcode) and scanning (@zxing/browser).
//
// Payload: a deep-link URL so an external phone camera can open the app and
// auto-connect, while the in-app scanner parses the same URL to dial directly.
//   {appUrl}/#/receive?peer=<peerId>&code=<code>

import QRCode from 'qrcode';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { publicAppUrl } from '../config';

export interface ConnectPayload {
  peerId?: string;
  code?: string;
}

export function buildConnectUrl(payload: ConnectPayload): string {
  const params = new URLSearchParams();
  if (payload.peerId) params.set('peer', payload.peerId);
  if (payload.code) params.set('code', payload.code);
  const base = publicAppUrl || '';
  return `${base}/#/receive?${params.toString()}`;
}

/** Extract peer/code from a scanned string, whether it's a full URL or bare code. */
export function parseConnectPayload(text: string): ConnectPayload {
  const trimmed = text.trim();
  try {
    const url = new URL(trimmed);
    const query = url.hash.includes('?')
      ? new URLSearchParams(url.hash.slice(url.hash.indexOf('?') + 1))
      : url.searchParams;
    const peerId = query.get('peer') ?? undefined;
    const code = query.get('code') ?? undefined;
    if (peerId || code) return { peerId, code };
  } catch {
    /* not a URL */
  }
  if (/^\d{6}$/.test(trimmed)) return { code: trimmed };
  return { peerId: trimmed };
}

export async function renderQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6,
    color: { dark: '#1b1712ff', light: '#00000000' },
  });
}

/**
 * Continuously scan a <video> element for QR codes. Resolves nothing; instead
 * `onResult` fires for each decode. Call the returned stop() to release camera.
 */
export async function startScanner(
  video: HTMLVideoElement,
  onResult: (payload: ConnectPayload) => void,
  onError: (message: string) => void,
): Promise<IScannerControls | null> {
  const reader = new BrowserQRCodeReader();
  try {
    return await reader.decodeFromVideoDevice(undefined, video, (result, err) => {
      if (result) onResult(parseConnectPayload(result.getText()));
      // `err` is thrown on every non-decodable frame; ignore those.
      void err;
    });
  } catch (e) {
    onError(
      e instanceof Error && e.name === 'NotAllowedError'
        ? 'Camera access was blocked. Allow the camera or enter the code manually.'
        : 'Could not start the camera. Enter the code manually instead.',
    );
    return null;
  }
}
