import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/primitives';

interface NameModalProps {
  title: string;
  banner: string;
  initial: string;
  confirmLabel: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
  helper?: string;
}

function NameModal({ title, banner, initial, confirmLabel, onConfirm, onClose, helper }: NameModalProps) {
  const [name, setName] = useState(initial);
  const submit = () => {
    if (name.trim()) onConfirm(name.trim());
  };
  return (
    <Modal onClose={onClose} banner={banner}>
      <div className="modal__body">
        <h2 className="modal__title">{title}</h2>
        {helper && <p className="modal__lede">{helper}</p>}
        <input
          className="input input--mono"
          autoFocus
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      <div className="modal__footer">
        <Button onClick={onClose}>
          <X size={15} /> Cancel
        </Button>
        <Button variant="yellow" block onClick={submit} disabled={!name.trim()}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/** Rename this device (the editable pill on the home screen). */
export function EditNameModal({
  initial,
  onConfirm,
  onClose,
}: {
  initial: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  return (
    <NameModal
      banner="This device"
      title="Name this device"
      helper="Others see this name when you connect. It can change any time."
      initial={initial}
      confirmLabel="Save name"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

/** Set the name for a contact you're saving as a favorite. */
export function AddContactModal({
  initial,
  onConfirm,
  onClose,
}: {
  initial: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  return (
    <NameModal
      banner="Save contact"
      title="Name this contact"
      helper="You'll see this name under Online Favorites, even if they rename their device."
      initial={initial}
      confirmLabel={'Save contact'}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

/** Small star affordance used in the chat header. */
export function StarGlyph({ filled }: { filled?: boolean }) {
  return <Star size={18} fill={filled ? 'currentColor' : 'none'} />;
}
