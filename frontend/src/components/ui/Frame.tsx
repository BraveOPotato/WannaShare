import type { ReactNode } from 'react';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from './primitives';
import { useTheme } from '../../state/ThemeProvider';

/** The bounded, phone-like column that holds the whole app. */
export function Frame({ children }: { children: ReactNode }) {
  return <div className="frame">{children}</div>;
}

export function ThemeToggle() {
  const { effective, toggle } = useTheme();
  return (
    <IconButton
      label={effective === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggle}
    >
      {effective === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </IconButton>
  );
}

export function BackButton({ to = -1 as const }: { to?: number | string }) {
  const navigate = useNavigate();
  return (
    <IconButton
      label="Go back"
      onClick={() => (typeof to === 'number' ? navigate(to) : navigate(to))}
    >
      <ArrowLeft size={18} />
    </IconButton>
  );
}

interface HeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  /** Show the pink top accent (used on sub-screens). */
  accent?: boolean;
}

export function Header({ title, subtitle, leading, actions, accent = true }: HeaderProps) {
  return (
    <header className={accent ? 'header' : 'header header--plain'}>
      {leading}
      <div className="header__title">
        {title}
        {subtitle != null && <span className="header__title-sub">{subtitle}</span>}
      </div>
      {actions != null && <div className="header__actions">{actions}</div>}
    </header>
  );
}
