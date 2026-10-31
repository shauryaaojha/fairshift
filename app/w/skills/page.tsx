import { Suspense } from 'react';
import Link from 'next/link';
import { Stamp } from '@/src/components/ui/Stamp';
import { Screen } from '@/src/components/worker/Screen';
import { ShareLink } from '@/src/components/worker/ShareLink';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import {
  formatDay,
  getLocale,
  loadSkills,
  requireWorkerContext,
} from '@/src/server/services/workerViews';
import { ScreenSkeleton } from '@/src/components/worker/ScreenSkeleton';

async function SkillsScreen() {
  const [ctx, cookieLocale] = await Promise.all([requireWorkerContext(), getLocale()]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  const skills = await loadSkills(ctx.worker.id);

  return (
    <Screen
      title={t(locale, 'skills.title')}
      speakText={t(locale, 'skills.speak')}
      backLabel={t(locale, 'common.back')}
      transitionName="tile-skills"
    >
      {skills.length === 0 ? (
        <p className="text-body">{t(locale, 'skills.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {skills.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-3 rounded-[10px] bg-card p-4 shadow-[var(--shadow-paper)]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-h2 min-w-0">{s.title}</p>
                <Stamp variant={s.verified ? 'cleared' : 'ink'} id={s.id} animate={false}>
                  {t(locale, s.verified ? 'skills.verified' : 'skills.notVerified')}
                </Stamp>
              </div>
              <p className="text-body">{t(locale, 'skills.issuedBy', { issuer: s.issuer })}</p>
              <p className="text-small text-muted">
                {t(locale, 'skills.issued', { date: formatDay(s.issuedDate, locale) })}
                {s.expiryDate
                  ? ` · ${t(locale, 'skills.expires', { date: formatDay(s.expiryDate, locale) })}`
                  : ''}
              </p>
              <ShareLink path={`/passport/${s.verifyToken}`} title={s.title} />
              <Link
                href={`/passport/${s.verifyToken}`}
                className="inline-flex min-h-12 items-center font-semibold text-ink underline underline-offset-4"
              >
                {t(locale, 'skills.openVerify')}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}

// Worker data comes from the session cookie, so the screen streams into a skeleton and a
// navigation between worker screens shows something at once.
export default function SkillsPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <SkillsScreen />
    </Suspense>
  );
}
