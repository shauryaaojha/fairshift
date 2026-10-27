import type { CSSProperties, ReactNode } from 'react';
import './ui.css';

export type StampVariant = 'ink' | 'cleared' | 'escalated' | 'hivis';

/**
 * Deterministic rotation from -4deg to +3deg derived from the record id,
 * so the same record always lands at the same angle and never jitters.
 */
export function stampRotation(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return -4 + (h % 71) / 10;
}

type StampProps = {
  variant?: StampVariant;
  /** Record id: the seed for the resting angle. */
  id?: string;
  /** Optional small line under the main text (e.g. "Anonymous"). */
  sub?: ReactNode;
  /** Announce to screen readers as a live confirmation. Only for real confirmations. */
  announce?: boolean;
  /** Play the 320 ms landing animation. Defaults to true. */
  animate?: boolean;
  /** Wait this long before landing (e.g. after payslip rows have risen). */
  delayMs?: number;
  className?: string;
  children: ReactNode;
};

/**
 * The rubber stamp: the signature mark for every confirmed action.
 * A real text element, not an image. Only `announce` stamps are live regions. The landing
 * animation is CSS only and is switched off by prefers-reduced-motion.
 */
export function Stamp({
  variant = 'ink',
  id = 'stamp',
  sub,
  announce = false,
  animate = true,
  delayMs,
  className = '',
  children,
}: StampProps) {
  const style = {
    '--stamp-rotation': `${stampRotation(id).toFixed(1)}deg`,
    ...(delayMs ? { animationDelay: `${delayMs}ms` } : {}),
  } as CSSProperties;
  const classes = ['stamp', `stamp-${variant}`, animate ? 'stamp-animate' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <span
      {...(announce ? { role: 'status', 'aria-live': 'polite' as const } : {})}
      className={classes}
      style={style}
      data-variant={variant}
    >
      <span>{children}</span>
      {sub ? <span className="stamp-sub">{sub}</span> : null}
    </span>
  );
}
