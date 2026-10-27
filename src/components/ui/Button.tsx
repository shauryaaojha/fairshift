import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

const base =
  'inline-flex items-center justify-center gap-2 rounded-[10px] text-center font-semibold leading-snug ' +
  'touch-manipulation disabled:opacity-50 disabled:pointer-events-none';

const variants: Record<ButtonVariant, string> = {
  // 56 px, the one primary action at the bottom of a screen.
  primary: 'w-full min-h-14 px-5 bg-ink text-white active:bg-ink-deep',
  secondary: 'min-h-12 px-4 bg-card text-ink border-2 border-ink active:bg-paper',
  // Hi-vis shapes always carry a 2 px graphite outline; text is graphite, never white.
  danger:
    'w-full min-h-14 px-5 bg-hivis text-graphite border-2 border-graphite active:bg-[#e84f17]',
};

export function buttonClasses(variant: ButtonVariant, fullWidth?: boolean, extra = ''): string {
  const width = fullWidth && variant === 'secondary' ? 'w-full' : '';
  return [base, variants[variant], width, extra].filter(Boolean).join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

export function Button({
  variant = 'primary',
  fullWidth,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, fullWidth, className)} {...rest} />;
}

export function ButtonLink({
  href,
  variant = 'primary',
  fullWidth,
  className = '',
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, fullWidth, className)}>
      {children}
    </Link>
  );
}
