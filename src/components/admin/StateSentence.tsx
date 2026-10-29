import Link from 'next/link';
import { Magnetic } from '@/src/components/motion/Magnetic';
import type { SentenceSegment } from '@/src/server/services/adminRows';

/** One sentence of state. Every number is a link to the rows behind it. */
export function StateSentence({ segments }: { segments: SentenceSegment[] }) {
  return (
    <p className="state-sentence">
      {segments.map((s, i) =>
        s.href ? (
          <Magnetic key={i}>
            <Link
              href={s.href}
              className="state-link mono underline decoration-2 underline-offset-4"
            >
              {s.text}
            </Link>
          </Magnetic>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </p>
  );
}
