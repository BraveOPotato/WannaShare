import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  /** Optional top banner label (e.g. "NEW DEVICE"). */
  banner?: ReactNode;
  onClose?: () => void;
  /** Clicking the backdrop closes the modal when true. */
  dismissable?: boolean;
  children: ReactNode;
}

export function Modal({ banner, onClose, dismissable = true, children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [dismissable, onClose]);

  return (
    <div
      className="overlay"
      role="presentation"
      onClick={() => dismissable && onClose?.()}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {banner != null && <div className="modal__banner">{banner}</div>}
        {children}
      </div>
    </div>
  );
}
