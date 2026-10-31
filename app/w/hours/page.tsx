import { Suspense } from 'react';
import Link from 'next/link';
import { FatigueCards } from '@/src/components/worker/FatigueCards';
import { Screen } from '@/src/components/worker/Screen';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import {
  describeFatigue,
  formatDay,
  getLocale,
  loadHours,
  requireWorkerContext,
} from '@/src/server/services/workerViews';
import { ScreenSkeleton } from '@/src/components/worker/ScreenSkeleton';

async function HoursScreen() {
  const [ctx, cookieLocale] = await Promise.all([requireWorkerContext(), getLocale()]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  const { week, fatigueFlags } = await loadHours(ctx.worker);
  const notes = describeFatigue(fatigueFlags, locale);
  const hoursText = (n: number) => t(locale, 'common.hours', { n });

  return (
    <Screen
      title={t(locale, 'hours.title')}
      speakText={t(locale, 'hours.speak', { total: week.totalHours })}
      backLabel={t(locale, 'common.back')}
      transitionName="tile-hours"
    >
      <section className="rounded-[10px] bg-card p-4 shadow-[var(--shadow-paper)]">
        <p className="text-small text-muted">
          {t(locale, 'hours.week')} · {t(locale, 'hours.total')}
        </p>
        <p className="text-display text-mono">{hoursText(week.totalHours)}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-small text-muted">{t(locale, 'hours.regular')}</dt>
            <dd className="text-mono">{hoursText(week.overtime.regularHours)}</dd>
          </div>
          <div>
            <dt className="text-small text-muted">{t(locale, 'hours.overtime')}</dt>
            <dd className="text-mono">{hoursText(week.overtime.overtimeHours)}</dd>
          </div>
        </dl>
      </section>

      {notes.length > 0 ? (
        <FatigueCards title={t(locale, 'hours.flagsTitle')} notes={notes} />
      ) : (
        <p className="text-body font-semibold text-cleared">{t(locale, 'hours.allGood')}</p>
      )}

      {week.rows.length === 0 ? (
        <p className="text-body">{t(locale, 'hours.noShifts')}</p>
      ) : (
        <p className="text-small text-muted">{t(locale, 'hours.receiptNote')}</p>
      )}
      {week.rows.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {week.rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-[10px] bg-card px-4 py-3 shadow-[var(--shadow-paper)]"
            >
              <div className="min-w-0">
                <p className="text-body font-semibold">{formatDay(r.date, locale, true)}</p>
                <p className="text-mono text-muted">
                  {r.checkIn} - {r.checkOut ?? '...'}
                </p>
                {r.receipt ? (
                  <Link
                    href={`/verify/${r.receipt.token}`}
                    className="link text-small"
                    prefetch={false}
                  >
                    {t(locale, 'hours.receipt', { code: r.receipt.code })}
                  </Link>
                ) : null}
              </div>
              <p className="text-mono shrink-0">
                {r.open ? t(locale, 'hours.onSite') : hoursText(r.hours)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}

// Worker data comes from the session cookie, so the screen streams into a skeleton and a
// navigation between worker screens shows something at once.
export default function HoursPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <HoursScreen />
    </Suspense>
  );
}
