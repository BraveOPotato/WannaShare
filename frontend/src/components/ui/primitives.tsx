import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'yellow' | 'pink';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  size?: 'md' | 'lg';
}

export function Button({
  variant = 'default',
  block,
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant === 'yellow' && 'btn--yellow',
    variant === 'pink' && 'btn--pink',
    block && 'btn--block',
    size === 'lg' && 'btn--lg',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
}

export function IconButton({ label, active, className = '', children, ...rest }: IconButtonProps) {
  return (
    <button
      className={['icon-btn', active && 'icon-btn--active', className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`pill ${className}`}>{children}</span>;
}

export function Eyebrow({
  children,
  ghost,
  className = '',
}: {
  children: ReactNode;
  ghost?: boolean;
  className?: string;
}) {
  return (
    <span className={['eyebrow', ghost && 'eyebrow--ghost', className].filter(Boolean).join(' ')}>
      {children}
    </span>
  );
}
