import { useRef, useState } from 'react';
import { Paperclip, SendHorizontal } from 'lucide-react';

interface ComposerProps {
  onSendText: (text: string) => void;
  onSendFiles: (files: FileList) => void;
  disabled?: boolean;
}

export function Composer({ onSendText, onSendFiles, disabled }: ComposerProps) {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText('');
  };

  return (
    <div className="composer">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files && e.target.files.length) onSendFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        className="icon-btn composer__attach"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        aria-label="Attach a file"
        type="button"
      >
        <Paperclip size={18} />
      </button>
      <input
        className="composer__input"
        placeholder="Message or paste a link…"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button
        className="icon-btn composer__send"
        onClick={submit}
        disabled={disabled || !text.trim()}
        aria-label="Send message"
        type="button"
      >
        <SendHorizontal size={18} />
      </button>
    </div>
  );
}
