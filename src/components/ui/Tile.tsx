import Link from 'next/link';
import { ViewTransition, type ReactNode } from 'react';

type TileProps = {
  href: string;
  label: string;
  icon: ReactNode;
  /** `danger` is hi-vis with a graphite outline. Used only for hazards. */
  tone?: 'default' | 'danger';
  /** Shared view-transition name; the destination TopBar uses the same one. */
  transitionName?: string;
};

/** A register tile: an icon on a tinted chip plus one word. Hazards keep the hi-vis tile. */
export function Tile({ href, label, icon, tone = 'default', transitionName }: TileProps) {
  const danger = tone === 'danger';
  const link = (
    <Link
      href={href}
      className={
        'flex min-h-24 flex-col items-start justify-between gap-3 rounded-[10px] p-3.5 touch-manipulation ' +
        'shadow-[var(--shadow-paper)] text-graphite ' +
        (danger ? 'bg-hivis border-2 border-graphite' : 'bg-card border border-rule')
      }
    >
      <span className={danger ? 'tile-chip tile-chip-danger' : 'tile-chip'}>{icon}</span>
      <span className="text-label text-base font-semibold leading-snug">{label}</span>
    </Link>
  );
  return transitionName ? <ViewTransition name={transitionName}>{link}</ViewTransition> : link;
}
