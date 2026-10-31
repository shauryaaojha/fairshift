import { Suspense } from 'react';
import { Screen } from '@/src/components/worker/Screen';
import { AskChat } from '@/src/components/worker/AskChat';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import { getLocale, requireWorkerContext } from '@/src/server/services/workerViews';
import { ScreenSkeleton } from '@/src/components/worker/ScreenSkeleton';

async function AskScreen() {
  const [, cookieLocale] = await Promise.all([requireWorkerContext(), getLocale()]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;

  return (
    <Screen
      title={t(locale, 'ask.title')}
      speakText={t(locale, 'ask.intro')}
      backLabel={t(locale, 'common.back')}
      transitionName="tile-ask"
    >
      <AskChat />
    </Screen>
  );
}

// Worker data comes from the session cookie, so the screen streams into a skeleton and a
// navigation between worker screens shows something at once.
export default function AskPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <AskScreen />
    </Suspense>
  );
}
