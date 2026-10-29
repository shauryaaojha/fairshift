import { Stamp, type StampVariant } from '@/src/components/ui/Stamp';
import type { HazardStatus } from '@/src/shared/types';

const STATUS: Record<HazardStatus, { variant: StampVariant; word: string }> = {
  escalated: { variant: 'escalated', word: 'Escalated' },
  reported: { variant: 'hivis', word: 'Logged' },
  acknowledged: { variant: 'ink', word: 'Acknowledged' },
  resolved: { variant: 'cleared', word: 'Resolved' },
};

/** Hazard status as a small, table-sized rubber stamp (word + colour + shape). */
export function StatusStamp({ status, id }: { status: HazardStatus; id: string }) {
  const s = STATUS[status];
  return (
    <span className="cell-stamp">
      <Stamp variant={s.variant} id={id} animate={false}>
        {s.word}
      </Stamp>
    </span>
  );
}

export function RiskStamp({ score, id }: { score: number; id: string }) {
  const variant: StampVariant = score > 50 ? 'escalated' : score > 25 ? 'hivis' : 'cleared';
  const word = score > 50 ? 'High' : score > 25 ? 'Watch' : 'Steady';
  return (
    <span className="cell-stamp">
      <Stamp variant={variant} id={id} animate={false}>
        {word}
      </Stamp>
    </span>
  );
}
