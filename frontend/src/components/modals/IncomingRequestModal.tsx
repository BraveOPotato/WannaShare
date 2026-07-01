import { Check, Monitor, ShieldAlert, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/primitives';
import { useSession } from '../../state/SessionProvider';
import { useCountdown } from '../../hooks/useCountdown';

/** Shown to the callee when another device dials them. */
export function IncomingRequestModal() {
  const { incoming, acceptIncoming, declineIncoming } = useSession();
  if (!incoming) return null;
  return <IncomingRequestModalInner deadline={incoming.deadline} name={incoming.remote.displayName} onAccept={acceptIncoming} onDecline={declineIncoming} />;
}

function IncomingRequestModalInner({
  deadline,
  name,
  onAccept,
  onDecline,
}: {
  deadline: number;
  name: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const seconds = useCountdown(deadline);
  return (
    <Modal
      dismissable={false}
      banner={
        <>
          <ShieldAlert size={14} /> New device
        </>
      }
    >
      <div className="modal__body request">
        <span className="request__avatar">
          <Monitor size={30} />
        </span>
        <h2 className="request__name">{name}</h2>
        <p className="request__sub">is requesting to connect with you</p>
        <span className="countdown" aria-hidden>
          {seconds}
        </span>
        <p className="request__timer">Auto-declining in {seconds}s</p>
      </div>
      <div className="modal__footer">
        <Button block onClick={onDecline}>
          <X size={16} /> Decline
        </Button>
        <Button block variant="pink" onClick={onAccept}>
          <Check size={16} /> Accept
        </Button>
      </div>
    </Modal>
  );
}
