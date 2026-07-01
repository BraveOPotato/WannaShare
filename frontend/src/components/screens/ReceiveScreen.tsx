import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, Star, Wifi, X } from 'lucide-react';
import { Frame, Header, BackButton, ThemeToggle } from '../ui/Frame';
import { Button, Eyebrow } from '../ui/primitives';
import { CodeInput, Keypad } from '../connect/CodeEntry';
import { QrScanner } from '../connect/Qr';
import { DeviceRow } from '../connect/DeviceRow';
import { useSession } from '../../state/SessionProvider';
import { useFavorites } from '../../state/FavoritesProvider';
import type { ConnectPayload } from '../../lib/qr';

export function ReceiveScreen() {
  const { dial, resolveAndDial, watchNetwork, networkDevices, favoritesOnline, phase, remote } =
    useSession();
  const { getFavorite } = useFavorites();
  const [params] = useSearchParams();

  const [value, setValue] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  // Subscribe to same-network presence while this screen is open.
  useEffect(() => {
    watchNetwork(true);
    return () => watchNetwork(false);
  }, [watchNetwork]);

  const tryCode = useCallback(
    (codeStr: string) => {
      attemptedRef.current = true;
      void resolveAndDial(codeStr).finally(() => setValue(''));
    },
    [resolveAndDial],
  );

  const onPayload = useCallback(
    (payload: ConnectPayload) => {
      setScanning(false);
      if (payload.peerId) dial(payload.peerId);
      else if (payload.code) tryCode(payload.code);
    },
    [dial, tryCode],
  );

  // Deep-link: /#/receive?peer=... or ?code=... (e.g. from a phone camera).
  useEffect(() => {
    if (attemptedRef.current) return;
    const peer = params.get('peer');
    const codeParam = params.get('code');
    if (peer) {
      attemptedRef.current = true;
      dial(peer);
    } else if (codeParam && /^\d{6}$/.test(codeParam)) {
      tryCode(codeParam);
    }
  }, [params, dial, tryCode]);

  // Auto-submit once six digits are entered.
  useEffect(() => {
    if (value.length === 6) tryCode(value);
  }, [value, tryCode]);

  // Physical keyboard support (when not scanning).
  useEffect(() => {
    if (scanning) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setValue((v) => (v.length < 6 ? v + e.key : v));
      else if (e.key === 'Backspace') setValue((v) => v.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scanning]);

  const dialing = phase === 'dialing';

  return (
    <Frame>
      <Header title="Receive" leading={<BackButton to="/" />} actions={<ThemeToggle />} />
      <div className="frame__body">
        {scanning ? (
          <div className="scan-panel">
            <QrScanner onDetected={onPayload} onError={setScanError} />
            {scanError && <p className="scan-error">{scanError}</p>}
            <Button block onClick={() => setScanning(false)}>
              <X size={16} /> Stop scanning
            </Button>
          </div>
        ) : (
          <>
            <h1 className="receive-title">Enter the 6-digit code</h1>
            <p className="receive-help">
              On the sending device, open WannaSend → <strong>Send</strong> and enter the code shown
              below the QR code.
            </p>

            <CodeInput value={value} />
            <Keypad
              onDigit={(d) => setValue((v) => (v.length < 6 ? v + d : v))}
              onBackspace={() => setValue((v) => v.slice(0, -1))}
            />

            {dialing && (
              <p className="dialing-note">Connecting to {remote?.displayName ?? 'device'}…</p>
            )}

            <div className="divider">
              <span>or</span>
            </div>

            <Button block onClick={() => { setScanError(null); setScanning(true); }}>
              <Camera size={16} /> Scan QR code
            </Button>

            {/* Online Favorites — starred contacts currently reachable. */}
            {favoritesOnline.length > 0 && (
              <section className="section">
                <div className="section__head">
                  <Eyebrow>
                    <Star size={13} fill="currentColor" /> Online favorites
                  </Eyebrow>
                </div>
                <div className="section__list">
                  {favoritesOnline.map((device) => {
                    const fav = getFavorite(device.deviceId);
                    const label = fav?.displayName ?? device.displayName;
                    return (
                      <DeviceRow
                        key={device.deviceId}
                        name={label}
                        favorite
                        onClick={() => dial(device.peerId, { deviceId: device.deviceId, displayName: label })}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* On This Network — peers sharing this public network. */}
            <section className="section">
              <div className="section__head">
                <Eyebrow>
                  <Wifi size={13} /> On this network
                </Eyebrow>
              </div>
              {networkDevices.length > 0 ? (
                <div className="section__list">
                  {networkDevices.map((device) => (
                    <DeviceRow
                      key={device.deviceId}
                      name={device.displayName}
                      onClick={() =>
                        dial(device.peerId, { deviceId: device.deviceId, displayName: device.displayName })
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="empty-note">No other devices on this network yet.</p>
              )}
            </section>
          </>
        )}
      </div>
    </Frame>
  );
}
