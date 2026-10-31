import { Suspense } from 'react';
import { LanguageGate } from '@/src/components/worker/LanguageGate';
import { LoginForm } from '@/src/components/worker/LoginForm';
import { ScreenSkeleton } from '@/src/components/worker/ScreenSkeleton';
import { TopBar } from '@/src/components/ui/TopBar';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import { getLocale } from '@/src/server/services/workerViews';

type Search = Promise<{ lang?: string; next?: string }>;

async function Login({ searchParams }: { searchParams: Search }) {
  const [{ lang, next }, locale] = await Promise.all([searchParams, getLocale()]);
  // First visit (no language cookie) or "Change language": show the gate.
  if (!locale || lang === '1') {
    const gateNext = next ? `/w/login?next=${encodeURIComponent(next)}` : '/w/login';
    return <LanguageGate current={locale ?? DEFAULT_LOCALE} next={gateNext} />;
  }
  return (
    <div className="flex flex-1 flex-col">
      <TopBar
        title={t(locale, 'login.title')}
        speakText={t(locale, 'login.speak')}
        backLabel={t(locale, 'common.back')}
        backHref={next ? `/w/login?lang=1&next=${encodeURIComponent(next)}` : '/w/login?lang=1'}
      />
      <LoginForm next={next} />
    </div>
  );
}

// The gate and the form both depend on the URL, so they stream into a skeleton: moving between
// them (?lang=1 and back) re-renders only this page, below the worker layout's own boundary.
export default function WorkerLoginPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}
