import { Check, CheckCheck, Download, FileText, RotateCcw, X } from 'lucide-react';
import type { DeliveryState, FileMessage, TextMessage } from '../../types';
import { formatBytes, formatClock } from '../../lib/format';

function StatusIcon({ state }: { state: DeliveryState }) {
  if (state === 'sending') return <Check size={13} aria-label="Sending" />;
  if (state === 'sent') return <CheckCheck size={13} aria-label="Delivered" />;
  if (state === 'failed' || state === 'canceled')
    return <X size={13} className="status-x" aria-label="Failed" />;
  return null;
}

export function MessageBubble({ message }: { message: TextMessage }) {
  const out = message.direction === 'out';
  return (
    <div className={`bubble-row ${out ? 'bubble-row--out' : 'bubble-row--in'}`}>
      <div className={`bubble ${out ? 'bubble--out' : 'bubble--in'}`}>{message.text}</div>
      <div className="bubble__meta">
        {formatClock(message.ts)}
        {out && <StatusIcon state={message.state} />}
      </div>
    </div>
  );
}

interface FileBubbleProps {
  message: FileMessage;
  onDownload: (m: FileMessage) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

export function FileBubble({ message, onDownload, onCancel, onRetry }: FileBubbleProps) {
  const out = message.direction === 'out';
  const inTransit = message.state === 'sending' && message.progress < 1;
  const receivable = message.direction === 'in' && message.state === 'received' && message.url;
  const failed = message.state === 'failed';
  const canceled = message.state === 'canceled';

  return (
    <div className={`bubble-row ${out ? 'bubble-row--out' : 'bubble-row--in'}`}>
      <div className={`file-card ${out ? 'file-card--out' : 'file-card--in'}`}>
        <span className="file-icon">
          <FileText size={20} />
        </span>
        <span className="file-info">
          <span className="file-name" title={message.name}>
            {message.name}
          </span>
          <span className="file-size">
            {canceled ? 'Canceled' : failed ? 'Failed' : formatBytes(message.size)}
          </span>
          {inTransit && (
            <span className="file-progress" aria-hidden>
              <span className="file-progress__bar" style={{ width: `${Math.round(message.progress * 100)}%` }} />
            </span>
          )}
        </span>

        {receivable && (
          <button className="file-action" onClick={() => onDownload(message)} aria-label="Download file">
            <Download size={18} />
          </button>
        )}
        {out && inTransit && (
          <button className="file-action" onClick={() => onCancel(message.id)} aria-label="Cancel transfer">
            <X size={18} />
          </button>
        )}
        {out && failed && (
          <button className="file-action" onClick={() => onRetry(message.id)} aria-label="Retry transfer">
            <RotateCcw size={18} />
          </button>
        )}
      </div>
      <div className="bubble__meta">
        {formatClock(message.ts)}
        {out && <StatusIcon state={message.state} />}
      </div>
    </div>
  );
}
