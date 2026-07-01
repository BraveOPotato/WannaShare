import { useEffect } from 'react';
import { RefreshCw, ScanLine } from 'lucide-react';
import { Frame, Header, BackButton, ThemeToggle } from '../ui/Frame';
import { Button, Eyebrow } from '../ui/primitives';
import { QrDisplay } from '../connect/Qr';
import { CodeDisplay } from '../connect/CodeEntry';
import { useSession } from '../../state/SessionProvider';

export function SendScreen() {
  const { myPeerId, code, refreshCode, startListening, stopListening, signalStatus } = useSession();

  useEffect(() => {
    startListening();
    return () => stopListening();
  }, [startListening, stopListening]);

  return (
    <Frame>
      <Header title="Send" leading={<BackButton to="/" />} actions={<ThemeToggle />} />
      <div className="frame__body">
        <div className="send-card">
          <Eyebrow>
            <ScanLine size={13} /> Scan to connect
          </Eyebrow>

          <QrDisplay peerId={myPeerId ?? undefined} code={code ?? undefined} />

          {code ? (
            <CodeDisplay code={code} />
          ) : (
            <p className="send-card__hint">
              {signalStatus === 'online' ? 'Generating a code…' : 'Connecting to the network…'}
            </p>
          )}

          <Button onClick={() => void refreshCode()} disabled={!myPeerId} className="new-code-btn">
            <RefreshCw size={14} /> New code
          </Button>
        </div>

        <p className="send-note">
          On the other device, choose <strong>Receive</strong> and scan this code — or type the six
          digits.
        </p>
      </div>
    </Frame>
  );
}
