import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor, MoreVertical, Trash2 } from 'lucide-react';
import { Frame, Header, ThemeToggle } from '../ui/Frame';
import { IconButton } from '../ui/primitives';
import { MessageBubble, FileBubble } from '../chat/Bubbles';
import { Composer } from '../chat/Composer';
import { AddContactModal, StarGlyph } from '../modals/NameModals';
import { useSession } from '../../state/SessionProvider';
import { useFavorites } from '../../state/FavoritesProvider';
import type { FileMessage } from '../../types';

export function ChatScreen() {
  const navigate = useNavigate();
  const { remote, items, phase, sendText, sendFiles, cancelFile, retryFile, leaveSession } =
    useSession();
  const { isFavorite, upsert, remove } = useFavorites();

  const [starOpen, setStarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Guard against landing here without an active session.
  useEffect(() => {
    if (phase !== 'connected' && phase !== 'dialing') navigate('/');
  }, [phase, navigate]);

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items]);

  const deviceId = remote?.deviceId;
  const starred = deviceId ? isFavorite(deviceId) : false;

  const onStar = () => {
    if (!deviceId) return;
    if (starred) remove(deviceId);
    else setStarOpen(true);
  };

  const download = (m: FileMessage) => {
    if (!m.url) return;
    const a = document.createElement('a');
    a.href = m.url;
    a.download = m.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const connected = phase === 'connected';

  return (
    <Frame>
      <Header
        title={remote?.displayName ?? 'Device'}
        subtitle={connected ? 'Online' : 'Connecting…'}
        leading={
          <IconButton label="Leave chat" onClick={leaveSession}>
            <ArrowLeft size={18} />
          </IconButton>
        }
        actions={
          <>
            <IconButton
              label={starred ? 'Remove from favorites' : 'Save as contact'}
              onClick={onStar}
              active={starred}
              disabled={!deviceId}
              title={deviceId ? undefined : 'Waiting for device identity…'}
            >
              <StarGlyph filled={starred} />
            </IconButton>
            <ThemeToggle />
            <div className="menu-wrap">
              <IconButton label="More options" onClick={() => setMenuOpen((o) => !o)}>
                <MoreVertical size={18} />
              </IconButton>
              {menuOpen && (
                <>
                  <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                  <div className="menu" role="menu">
                    <button
                      className="menu__item"
                      onClick={() => {
                        setMenuOpen(false);
                        leaveSession();
                      }}
                    >
                      <Trash2 size={15} /> Leave chat
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        }
      />

      <div className="messages" role="log" aria-live="polite">
        {items.length === 0 && (
          <div className="messages__empty">
            <span className="device-row__icon">
              <Monitor size={22} />
            </span>
            <p>You&apos;re connected. Send a message or a file to get started.</p>
          </div>
        )}
        {items.map((item) =>
          item.type === 'text' ? (
            <MessageBubble key={item.id} message={item} />
          ) : (
            <FileBubble
              key={item.id}
              message={item}
              onDownload={download}
              onCancel={cancelFile}
              onRetry={retryFile}
            />
          ),
        )}
        <div ref={endRef} />
      </div>

      <Composer onSendText={sendText} onSendFiles={sendFiles} disabled={!connected} />

      {starOpen && deviceId && (
        <AddContactModal
          initial={remote?.displayName ?? ''}
          onConfirm={(name) => {
            upsert(deviceId, name);
            setStarOpen(false);
          }}
          onClose={() => setStarOpen(false)}
        />
      )}
    </Frame>
  );
}
