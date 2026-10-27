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

/** A flat register tile: a big custom icon plus one word. */
export function Tile({ href, label, icon, tone = 'default', transitionName }: TileProps) {
  const toneClass =
    tone === 'danger'
      ? 'bg-hivis border-2 border-graphite text-graphite'
      : 'bg-card border-2 border-graphite text-graphite';
  const link = (
    <Link
      href={href}
      className={
        'flex min-h-28 flex-col items-start justify-between gap-3 rounded-[6px] p-4 touch-manipulation ' +
        'shadow-[var(--shadow-paper)] ' +
        toneClass
      }
    >
      <span className={tone === 'danger' ? 'text-graphite' : 'text-ink'}>{icon}</span>
      <span className="text-label text-base font-semibold leading-snug">{label}</span>
    </Link>
  );
  return transitionName ? <ViewTransition name={transitionName}>{link}</ViewTransition> : link;
}
