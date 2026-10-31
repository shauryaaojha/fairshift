'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useT } from '@/src/i18n/client';

const MINUTE_MS = 60_000;

/**
 * Time on site since check-in, ticking each half minute, with a bar that fills over a normal day
 * and turns hi-vis once the shift runs into overtime. It starts from the server's render time, so
 * the first paint matches the server HTML.
 */
export function ShiftClock({
  since,
  renderedAt,
  dayHours,
  aside,
}: {
  since: string;
  renderedAt: number;
  dayHours: number;
  /** Shown beside the figure (the check-in stamp); the bar and note run full width below. */
  aside?: ReactNode;
}) {
  const t = useT();
  const [now, setNow] = useState(renderedAt);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    // Catch up at once (the page may come from the router cache), then every half minute.
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, MINUTE_MS / 2);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / MINUTE_MS));
  const dayMinutes = dayHours * 60;
  const over = minutes > dayMinutes;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-small text-muted">{t('home.shiftSoFar')}</p>
          <p className="shift-clock">
            {t('home.elapsed', { h: Math.floor(minutes / 60), m: minutes % 60 })}
          </p>
        </div>
        {aside}
      </div>
      <div
        className={`shift-bar${over ? ' is-over' : ''}`}
        role="progressbar"
        aria-label={t('home.progress')}
        aria-valuemin={0}
        aria-valuemax={dayMinutes}
        aria-valuenow={Math.min(minutes, dayMinutes)}
      >
        <span style={{ width: `${Math.min(100, (minutes / dayMinutes) * 100)}%` }} />
      </div>
      <p className="text-small">
        {over ? t('home.overtimeNow') : t('home.ofDay', { n: dayHours })}
      </p>
    </div>
  );
}
