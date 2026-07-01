import type { ReactNode } from 'react';
import { Monitor, Star } from 'lucide-react';

interface DeviceRowProps {
  name: string;
  onClick: () => void;
  /** Show a star glyph (used for favorites). */
  favorite?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
}

export function DeviceRow({ name, onClick, favorite, disabled, trailing }: DeviceRowProps) {
  return (
    <button className="device-row" onClick={onClick} disabled={disabled} type="button">
      <span className="device-row__icon">
        {favorite ? <Star size={20} fill="currentColor" /> : <Monitor size={20} />}
      </span>
      <span className="device-row__text">
        <span className="device-row__name">{name}</span>
        <span className="device-row__meta">
          <span className="dot-online" aria-hidden />
          Online · tap to connect
        </span>
      </span>
      {trailing}
    </button>
  );
}
