import { Delete } from 'lucide-react';

/** Read-only 6-digit code shown under the QR on the Send screen. */
export function CodeDisplay({ code }: { code: string }) {
  const digits = code.padEnd(6, ' ').slice(0, 6).split('');
  return (
    <div className="code-display" aria-label={`Connection code ${code}`}>
      {digits.map((d, i) => (
        <span className="code-digit" key={i}>
          {d.trim()}
        </span>
      ))}
    </div>
  );
}

/** Editable 6-cell code entry (display only; value is owned by the parent). */
export function CodeInput({ value, error }: { value: string; error?: boolean }) {
  const cells = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  const activeIndex = Math.min(value.length, 5);
  return (
    <div className="code-input" role="group" aria-label="6-digit code">
      {cells.map((c, i) => (
        <span
          key={i}
          className={[
            'code-cell',
            i === activeIndex && !c && 'code-cell--active',
            error && 'code-cell--error',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {c}
        </span>
      ))}
    </div>
  );
}

interface KeypadProps {
  onDigit: (d: string) => void;
  onBackspace: () => void;
}

export function Keypad({ onDigit, onBackspace }: KeypadProps) {
  return (
    <div className="keypad" role="group" aria-label="Number pad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
        <button key={n} className="key" type="button" onClick={() => onDigit(n)}>
          {n}
        </button>
      ))}
      <span aria-hidden />
      <button className="key" type="button" onClick={() => onDigit('0')}>
        0
      </button>
      <button className="key key--muted" type="button" onClick={onBackspace} aria-label="Delete">
        <Delete size={18} />
      </button>
    </div>
  );
}
