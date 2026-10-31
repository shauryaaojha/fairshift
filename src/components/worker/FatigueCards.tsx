import { ConeIcon } from '@/src/components/icons';
import type { FatigueNote } from '@/src/server/services/workerViews';

/**
 * Fatigue warnings in plain words. Hi-vis fill with a 2 px graphite outline
 * and graphite text (never white on hi-vis). Colour is paired with the cone icon and a title.
 */
export function FatigueCards({ title, notes }: { title: string; notes: FatigueNote[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="flex flex-col gap-3">
      {notes.map((n, i) => (
        <li
          key={`${n.type}-${i}`}
          className="flex gap-3 rounded-[10px] border-2 border-graphite bg-hivis p-4 text-graphite"
        >
          <span className="mt-0.5 shrink-0">
            <ConeIcon />
          </span>
          <div className="min-w-0">
            <p className="text-label font-semibold">{title}</p>
            <p className="text-body">{n.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
