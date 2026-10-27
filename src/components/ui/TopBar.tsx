import Link from 'next/link';
import { ViewTransition } from 'react';
import { BackIcon } from '@/src/components/icons';
import { ReadAloud } from './ReadAloud';

type TopBarProps = {
  title: string;
  /** Text spoken by the read-aloud button. Pass the screen's own words. */
  speakText: string;
  backHref?: string | null;
  backLabel?: string;
  /** Matches the Tile transitionName so the tile morphs into this header. */
  transitionName?: string;
};

/** Back, title, read-aloud. Every worker screen starts with this. */
export function TopBar({
  title,
  speakText,
  backHref = '/w',
  backLabel = 'Back',
  transitionName,
}: TopBarProps) {
  const bar = (
    <div className="flex items-center gap-2 px-4 py-2">
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex min-h-12 shrink-0 items-center gap-1 rounded-[10px] pr-3 text-ink font-semibold"
        >
          <BackIcon />
          <span>{backLabel}</span>
        </Link>
      ) : null}
      <h1 className="text-h1 min-w-0 flex-1 break-words">{title}</h1>
      <ReadAloud text={speakText || title} />
    </div>
  );
  return (
    <header className="sticky top-0 z-10 bg-paper">
      {transitionName ? <ViewTransition name={transitionName}>{bar}</ViewTransition> : bar}
    </header>
  );
}
