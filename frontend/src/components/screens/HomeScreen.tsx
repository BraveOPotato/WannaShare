import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Pencil, Send, Settings2 } from 'lucide-react';
import { Frame, ThemeToggle } from '../ui/Frame';
import { IconButton } from '../ui/primitives';
import { IceSettingsModal } from '../modals/IceSettingsModal';
import { EditNameModal } from '../modals/NameModals';
import { useIdentity } from '../../state/IdentityProvider';

export function HomeScreen() {
  const navigate = useNavigate();
  const { identity, rename } = useIdentity();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <Frame>
      <div className="home__top">
        <IconButton label="Connection server settings" onClick={() => setSettingsOpen(true)}>
          <Settings2 size={18} />
        </IconButton>
        <ThemeToggle />
      </div>

      <div className="home">
        <div className="brand">
          <span className="brand__mark">
            <Send size={22} />
          </span>
          <span className="brand__word">
            WannaSend<span className="brand__dot">.</span>
          </span>
        </div>

        <button className="name-pill" onClick={() => setEditOpen(true)} type="button">
          <span className="name-pill__text">{identity.displayName}</span>
          <span className="name-pill__edit" aria-hidden>
            <Pencil size={14} />
          </span>
        </button>

        <h1 className="hero">
          Drop anything.
          <br />
          <span className="hero__accent">Anywhere.</span>
        </h1>
        <p className="subtitle">Zero install. Zero accounts. Just pick a direction.</p>

        <div className="choices">
          <button className="choice choice--send" onClick={() => navigate('/send')} type="button">
            <span className="choice__icon">
              <ArrowUp size={20} />
            </span>
            <span className="choice__text">
              <span className="choice__title">Send</span>
              <span className="choice__desc">Share files, links &amp; messages</span>
            </span>
          </button>

          <button className="choice choice--receive" onClick={() => navigate('/receive')} type="button">
            <span className="choice__icon choice__icon--pink">
              <ArrowDown size={20} />
            </span>
            <span className="choice__text">
              <span className="choice__title">Receive</span>
              <span className="choice__desc">Accept files from another device</span>
            </span>
          </button>
        </div>

        <p className="footnote">Peer-to-peer · End-to-end encrypted · No data leaves your devices</p>
      </div>

      {settingsOpen && <IceSettingsModal onClose={() => setSettingsOpen(false)} />}
      {editOpen && (
        <EditNameModal
          initial={identity.displayName}
          onConfirm={(name) => {
            rename(name);
            setEditOpen(false);
          }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </Frame>
  );
}
