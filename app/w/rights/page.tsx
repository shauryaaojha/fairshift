import { Suspense } from 'react';
import Link from 'next/link';
import { ReadAloud } from '@/src/components/ui/ReadAloud';
import { Screen } from '@/src/components/worker/Screen';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import { getLocale, requireWorkerContext } from '@/src/server/services/workerViews';
import { COMPLAINT_STEPS, HELPLINES, RIGHTS, formatHelpline } from '@/src/shared/rights';
import { ScreenSkeleton } from '@/src/components/worker/ScreenSkeleton';

async function RightsScreen() {
  const [, cookieLocale] = await Promise.all([requireWorkerContext(), getLocale()]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;

  return (
    <Screen
      title={t(locale, 'rights.title')}
      speakText={t(locale, 'rights.speak')}
      backLabel={t(locale, 'common.back')}
      transitionName="tile-rights"
    >
      <p className="text-body">{t(locale, 'rights.intro')}</p>

      <ul className="flex flex-col gap-3">
        {RIGHTS.map((r) => {
          const title = t(locale, `rights.${r.id}.title`);
          const body = t(locale, `rights.${r.id}.body`);
          return (
            <li
              key={r.id}
              className="flex flex-col gap-2 rounded-[10px] bg-card p-4 shadow-[var(--shadow-paper)]"
            >
              <h2 className="text-h2">{title}</h2>
              <p className="text-body">{body}</p>
              <p className="text-small text-muted">
                {t(locale, 'rights.source', { source: r.source })}
              </p>
              <ReadAloud text={`${title}. ${body}`} />
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="complain" className="flex flex-col gap-2">
        <h2 id="complain" className="text-h2">
          {t(locale, 'rights.complain.title')}
        </h2>
        <p className="text-small text-muted">{t(locale, 'rights.complain.intro')}</p>
        <ol className="flex flex-col gap-2">
          {COMPLAINT_STEPS.map((c, i) => {
            const title = t(locale, `rights.complain.${c.id}.title`);
            const body = t(locale, `rights.complain.${c.id}.body`);
            return (
              <li
                key={c.id}
                className="flex flex-col gap-1 rounded-[10px] bg-card p-4 shadow-[var(--shadow-paper)]"
              >
                <h3 className="text-body font-semibold">
                  <span className="text-mono">{i + 1}.</span> {title}
                </h3>
                <p className="text-body">{body}</p>
                {c.href ? (
                  <StepLink href={c.href} label={t(locale, `rights.complain.${c.id}.go`)} />
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="helplines" className="flex flex-col gap-2">
        <h2 id="helplines" className="text-h2">
          {t(locale, 'rights.helplines')}
        </h2>
        <p className="text-small text-muted">{t(locale, 'rights.callHint')}</p>
        <ul className="flex flex-col gap-2">
          {HELPLINES.map((h) => {
            const shown = formatHelpline(h.number);
            return (
              <li key={h.id}>
                <a
                  href={`tel:${h.number}`}
                  aria-label={`${t(locale, `rights.help.${h.id}`)}. ${t(locale, 'rights.call', { number: shown })}`}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-[10px] border-2 border-graphite bg-card px-4 py-2"
                >
                  <span className="text-body">{t(locale, `rights.help.${h.id}`)}</span>
                  <span className="text-mono shrink-0 text-[1.25rem] font-semibold">{shown}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    </Screen>
  );
}

/** In-app steps use client navigation; the portal and the phone line are plain links. */
function StepLink({ href, label }: { href: string; label: string }) {
  const className = 'inline-flex min-h-12 items-center font-semibold text-ink underline';
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }
  const external = href.startsWith('http');
  return (
    <a
      href={href}
      className={className}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {label}
    </a>
  );
}

// Worker data comes from the session cookie, so the screen streams into a skeleton and a
// navigation between worker screens shows something at once.
export default function RightsPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <RightsScreen />
    </Suspense>
  );
}
