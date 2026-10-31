import { Suspense } from 'react';
import { Anek_Devanagari, Anek_Tamil } from 'next/font/google';
import { I18nProvider } from '@/src/i18n/client';
import { DEFAULT_LOCALE, dictionaries, t } from '@/src/i18n';
import { getLocale, getWorkerContext } from '@/src/server/services/workerViews';
import { HtmlLang } from '@/src/components/worker/HtmlLang';
import { OfflineSync } from '@/src/components/worker/OfflineSync';
import { WorkerTabs } from '@/src/components/worker/WorkerTabs';
import '@/src/components/ui/ui.css';
import '@/src/components/worker/worker.css';

// Only the script of the active language is applied. Both are non-preloaded and
// carry a unicode-range, so a phone downloads at most one Indic font file.
const anekDevanagari = Anek_Devanagari({
  variable: '--font-anek-deva',
  subsets: ['devanagari'],
  display: 'swap',
  axes: ['wdth'],
  preload: false,
});
const anekTamil = Anek_Tamil({
  variable: '--font-anek-tamil',
  subsets: ['tamil'],
  display: 'swap',
  axes: ['wdth'],
  preload: false,
});

async function Shell({ children }: { children: React.ReactNode }) {
  const [cookieLocale, ctx] = await Promise.all([getLocale(), getWorkerContext()]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  const workerId = ctx?.worker.id ?? null;
  const fontClass =
    locale === 'hi' ? anekDevanagari.variable : locale === 'ta' ? anekTamil.variable : '';
  return (
    <I18nProvider locale={locale} messages={dictionaries[locale]}>
      <HtmlLang locale={locale} />
      <div
        lang={locale}
        className={`worker-shell mx-auto flex w-full max-w-[480px] flex-1 flex-col ${fontClass}`}
      >
        <OfflineSync workerId={workerId} />
        {children}
        <p className="text-small py-4 text-center text-muted">{t(locale, 'common.demoData')}</p>
        {workerId ? <WorkerTabs /> : null}
      </div>
    </I18nProvider>
  );
}

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="worker-shell flex-1" aria-busy="true" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
