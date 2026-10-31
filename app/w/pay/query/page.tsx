import { Suspense } from 'react';
import { Screen } from '@/src/components/worker/Screen';
import { PayQueryForm } from '@/src/components/worker/PayQueryForm';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import { getLocale, requireWorkerContext } from '@/src/server/services/workerViews';
import { PAY_QUERY_REASONS, parseRupees } from '@/src/shared/payCheck';
import type { PayQueryReason } from '@/src/shared/types';
import { ScreenSkeleton } from '@/src/components/worker/ScreenSkeleton';

type SP = Promise<Record<string, string | string[] | undefined>>;

/** "Ask about your pay". The pay check links here with the amount the worker already typed. */
async function PayQueryScreen({ searchParams }: { searchParams: SP }) {
  const [sp, , cookieLocale] = await Promise.all([
    searchParams,
    requireWorkerContext(),
    getLocale(),
  ]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  const wanted = typeof sp.reason === 'string' ? sp.reason : '';
  const reason: PayQueryReason = (PAY_QUERY_REASONS as readonly string[]).includes(wanted)
    ? (wanted as PayQueryReason)
    : 'short_pay';
  // Only a readable amount is carried over; anything else starts empty.
  const received = typeof sp.received === 'string' ? parseRupees(sp.received) : null;

  return (
    <Screen
      title={t(locale, 'payq.newTitle')}
      speakText={t(locale, 'payq.speak')}
      backLabel={t(locale, 'common.back')}
      backHref="/w/pay"
    >
      <p className="text-body">{t(locale, 'payq.intro')}</p>
      <PayQueryForm
        initialReason={reason}
        initialReceived={received === null ? '' : String(received)}
      />
    </Screen>
  );
}

// Worker data comes from the session cookie, so the screen streams into a skeleton and a
// navigation between worker screens shows something at once.
export default function PayQueryPage(props: { searchParams: SP }) {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <PayQueryScreen {...props} />
    </Suspense>
  );
}
