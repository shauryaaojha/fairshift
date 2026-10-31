import { Suspense } from 'react';
import Link from 'next/link';
import { TopBar } from '@/src/components/ui/TopBar';
import { HazardForm } from '@/src/components/worker/HazardForm';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import { closureState } from '@/src/server/domain/hazardClosure';
import {
  formatClock,
  formatDay,
  getLocale,
  listMyHazards,
  requireWorkerContext,
} from '@/src/server/services/workerViews';
import { ScreenSkeleton } from '@/src/components/worker/ScreenSkeleton';

type Search = { category?: string; severity?: string; text?: string };

async function HazardScreen({ searchParams }: { searchParams: Promise<Search> }) {
  const [ctx, cookieLocale, initial] = await Promise.all([
    requireWorkerContext(),
    getLocale(),
    searchParams,
  ]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  const earlier = await listMyHazards(ctx.worker);

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title={t(locale, 'hazard.title')}
        speakText={t(locale, 'hazard.speak')}
        backLabel={t(locale, 'common.back')}
        transitionName="tile-hazard"
      />
      <HazardForm initial={initial} />
      {earlier.length > 0 ? (
        <section className="px-4 pb-4" aria-label={t(locale, 'hazard.earlier')}>
          <h2 className="text-h2 mb-2">{t(locale, 'hazard.earlier')}</h2>
          <ul className="flex flex-col gap-2">
            {earlier.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/w/hazard/${h.id}`}
                  className="flex min-h-14 flex-col justify-center rounded-[10px] bg-card px-4 py-2 shadow-[var(--shadow-paper)]"
                >
                  <span className="text-body font-semibold">{h.category}</span>
                  {closureState(h) === 'awaiting_reporter' ? (
                    <span className="text-body font-semibold text-escalated">
                      {t(locale, 'hazard.verdict.pending')}
                    </span>
                  ) : null}
                  <span className="text-small text-muted">
                    {t(locale, `hazard.status.${h.status}`)} · {formatDay(h.reportedAt, locale)}{' '}
                    <span className="text-mono">{formatClock(h.reportedAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

// Worker data comes from the session cookie, so the screen streams into a skeleton and a
// navigation between worker screens shows something at once.
export default function HazardPage(props: { searchParams: Promise<Search> }) {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <HazardScreen {...props} />
    </Suspense>
  );
}
