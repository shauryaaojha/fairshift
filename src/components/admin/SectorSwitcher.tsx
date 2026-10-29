import { SECTORS } from '@/src/server/services/sectors';
import type { Sector } from '@/src/shared/types';

/** Segmented control. Each segment is a form button so it works without JS. */
export function SectorSwitcher({
  current,
  allowed,
  action,
}: {
  current: Sector;
  /** Only sectors the signed-in admin may access are offered. */
  allowed: Sector[];
  action: (formData: FormData) => Promise<void>;
}) {
  if (allowed.length < 2) return null;
  return (
    <form action={action} className="sector-switch" aria-label="Sector">
      {allowed.map((key) => {
        const s = SECTORS[key];
        const active = key === current;
        return (
          <button
            key={key}
            type="submit"
            name="sector"
            value={key}
            aria-pressed={active}
            data-active={active || undefined}
            className="sector-btn"
          >
            <span className="sector-label">{s.label}</span>
            <span className="sector-place">{s.place}</span>
          </button>
        );
      })}
    </form>
  );
}
