import { useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { buildConnectUrl, renderQrDataUrl, startScanner, type ConnectPayload } from '../../lib/qr';

/** Renders a QR code for a peer/code payload (deep-link URL). */
export function QrDisplay({ peerId, code }: { peerId?: string; code?: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!peerId && !code) {
      setDataUrl(null);
      return;
    }
    const url = buildConnectUrl({ peerId, code });
    renderQrDataUrl(url)
      .then((d) => alive && setDataUrl(d))
      .catch(() => alive && setDataUrl(null));
    return () => {
      alive = false;
    };
  }, [peerId, code]);

  return (
    <div className="qr-wrap">
      {dataUrl ? (
        <img className="qr-img" src={dataUrl} alt="Connection QR code" />
      ) : (
        <div className="qr-img qr-img--empty">…</div>
      )}
    </div>
  );
}

/** Live camera scanner. Fires onDetected once with the parsed payload. */
export function QrScanner({
  onDetected,
  onError,
}: {
  onDetected: (payload: ConnectPayload) => void;
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let stopped = false;

    startScanner(
      video,
      (payload) => {
        if (doneRef.current) return;
        doneRef.current = true;
        controlsRef.current?.stop();
        onDetected(payload);
      },
      onError,
    ).then((controls) => {
      if (stopped) controls?.stop();
      else controlsRef.current = controls;
    });

    return () => {
      stopped = true;
      controlsRef.current?.stop();
    };
  }, [onDetected, onError]);

  return (
    <div className="scanner">
      <video ref={videoRef} playsInline muted />
      <div className="scanner__frame" aria-hidden />
    </div>
  );
}
