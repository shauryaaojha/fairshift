import { Suspense } from 'react';
import { TopBar } from '@/src/components/ui/TopBar';
import { CheckinPanel } from '@/src/components/worker/CheckinPanel';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import {
  formatClock,
  getLocale,
  loadHome,
  requireWorkerContext,
} from '@/src/server/services/workerViews';
import { ScreenSkeleton } from '@/src/components/worker/ScreenSkeleton';

async function CheckinScreen({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; code?: string }>;
}) {
  const [ctx, cookieLocale, params] = await Promise.all([
    requireWorkerContext(),
    getLocale(),
    searchParams,
  ]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  const { activeShift } = await loadHome(ctx.worker.id);
  // The site in the QR link is advisory: the server always checks in to the worker's own site.
  const code = params.code && /^\d{6}$/.test(params.code) ? params.code : null;

  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title={t(locale, 'checkin.title')}
        speakText={t(locale, 'checkin.speak')}
        backLabel={t(locale, 'common.back')}
        transitionName="tile-checkin"
      />
      <CheckinPanel
        activeSince={activeShift ? formatClock(activeShift.checkIn) : null}
        activeShiftId={activeShift?.id ?? null}
        initialCode={code}
      />
    </div>
  );
}

// Worker data comes from the session cookie, so the screen streams into a skeleton and a
// navigation between worker screens shows something at once.
export default function CheckinPage(props: {
  searchParams: Promise<{ site?: string; code?: string }>;
}) {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <CheckinScreen {...props} />
    </Suspense>
  );
}
