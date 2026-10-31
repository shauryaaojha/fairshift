import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/src/components/ui/Button';
import { PrintButton } from '@/src/components/worker/PrintButton';
import { Screen } from '@/src/components/worker/Screen';
import { DEFAULT_LOCALE, LOCALES, NATIVE_NAME, parseLocale, t } from '@/src/i18n';
import { requestOrigin } from '@/src/server/origin';
import {
  formatClock,
  formatDay,
  formatMonth,
  formatRupees,
  getLocale,
  loadLabourLetter,
  requireWorkerContext,
} from '@/src/server/services/workerViews';
import { ScreenSkeleton } from '@/src/components/worker/ScreenSkeleton';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}

/**
 * The letter to the labour office for a pay query the employer has not settled. The worker reads
 * the instructions in their app language and can print the letter itself in English, Hindi or
 * Tamil, whichever the office reads.
 */
async function LabourLetterScreen({ params, searchParams }: Props) {
  const [{ id }, { lang }, ctx, cookieLocale, origin] = await Promise.all([
    params,
    searchParams,
    requireWorkerContext(),
    getLocale(),
    requestOrigin(),
  ]);
  const ui = cookieLocale ?? DEFAULT_LOCALE;
  const locale = parseLocale(lang) ?? ui;
  const view = await loadLabourLetter(ctx.worker, id, origin);
  if (view === null) notFound();

  const back = `/w/pay/query/${encodeURIComponent(id)}`;
  if (view === 'not_ready') {
    return (
      <Screen
        title={t(ui, 'letter.title')}
        speakText={t(ui, 'letter.notReady')}
        backLabel={t(ui, 'common.back')}
        backHref={back}
        action={<ButtonLink href={back}>{t(ui, 'common.back')}</ButtonLink>}
      >
        <p className="text-body">{t(ui, 'letter.notReady')}</p>
      </Screen>
    );
  }

  const { letter, worker } = view;
  const month = formatMonth(letter.period, locale);
  const shortPaid = letter.received !== null && letter.gap !== null && letter.gap > 0;
  const workedParams = {
    month,
    days: letter.days,
    hours: letter.hours,
    overtime: letter.overtimeHours,
  };

  return (
    <div className="letter-page flex flex-col gap-4 py-4">
      <div className="no-print flex flex-col gap-3">
        <Link href={back} className="link">
          {t(ui, 'common.back')}
        </Link>
        <h1 className="text-h1">{t(ui, 'letter.title')}</h1>
        <p className="text-body">{t(ui, 'letter.how')}</p>
        <nav aria-label={t(ui, 'letter.language')} className="flex flex-wrap items-center gap-3">
          <span className="text-small text-muted">{t(ui, 'letter.language')}:</span>
          {LOCALES.map((l) => (
            <Link
              key={l}
              href={`?lang=${l}`}
              lang={l}
              className="link"
              aria-current={l === locale ? 'true' : undefined}
              replace
            >
              {NATIVE_NAME[l]}
            </Link>
          ))}
        </nav>
        <PrintButton label={t(ui, 'letter.print')} />
        <a href={view.verifyUrl} className="link text-small" target="_blank" rel="noopener">
          {t(ui, 'letter.preview')}
        </a>
      </div>

      <article className="letter" lang={locale} aria-label={t(locale, 'letter.title')}>
        <p className="letter-right">
          {t(locale, 'letter.date', { date: formatDay(new Date().toISOString(), locale) })}
        </p>

        <div>
          <p className="font-semibold">{t(locale, 'letter.to')}</p>
          <p>{t(locale, 'letter.toWho')}</p>
          <p>{t(locale, 'letter.toPlace', { site: view.site })}</p>
        </div>

        <div>
          <p className="font-semibold">{t(locale, 'letter.from')}</p>
          <p>{t(locale, 'letter.fromWho', { name: worker.name, phone: worker.phone })}</p>
          <p>{t(locale, 'letter.fromWork', { site: view.site, employer: view.employer })}</p>
        </div>

        <p className="font-semibold">{t(locale, 'letter.subject', { month })}</p>
        <p>{t(locale, 'letter.salutation')}</p>

        <p>
          {letter.shifts.length === 0
            ? t(locale, 'letter.noShifts', { month })
            : t(
                locale,
                letter.overtimeHours > 0 ? 'letter.worked' : 'letter.workedNoOt',
                workedParams,
              )}
        </p>
        <p>
          {shortPaid
            ? t(locale, 'letter.short', {
                net: formatRupees(letter.payslipNet),
                received: formatRupees(letter.received!),
                gap: formatRupees(letter.gap!),
              })
            : t(locale, 'letter.problem', {
                net: formatRupees(letter.payslipNet),
                reason: t(locale, `payq.reason.${letter.reason}`),
              })}
        </p>
        {letter.note ? <p>{t(locale, 'letter.note', { note: letter.note })}</p> : null}
        <p>
          {t(locale, 'letter.raised', {
            date: formatDay(letter.raisedAt, locale),
            due: `${formatDay(letter.answerDueAt, locale)} ${formatClock(letter.answerDueAt)}`,
          })}{' '}
          {letter.lastAnswer
            ? t(locale, 'letter.answered', {
                date: formatDay(letter.lastAnswer.at, locale),
                text: letter.lastAnswer.text,
              })
            : t(locale, 'letter.noAnswer')}
        </p>

        <p>{t(locale, 'letter.ask')}</p>
        <ul className="letter-laws">
          {letter.laws.map((law) => (
            <li key={law}>
              {t(locale, `letter.law.${law}`, {
                month,
                date: formatDay(letter.wagesDueBy, locale),
              })}
            </li>
          ))}
        </ul>

        {letter.shifts.length > 0 ? (
          <>
            <h2 className="text-h2">{t(locale, 'letter.proof')}</h2>
            <p>{t(locale, 'letter.proofBody')}</p>
            <div className="letter-proof">
              <table className="letter-table">
                <thead>
                  <tr>
                    <th scope="col">{t(locale, 'letter.col.date')}</th>
                    <th scope="col">{t(locale, 'letter.col.in')}</th>
                    <th scope="col">{t(locale, 'letter.col.out')}</th>
                    <th scope="col">{t(locale, 'letter.col.hours')}</th>
                    <th scope="col">{t(locale, 'letter.col.receipt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {letter.shifts.map((s) => (
                    <tr key={s.checkIn}>
                      <td>{formatDay(s.date, locale)}</td>
                      <td className="text-mono">{formatClock(s.checkIn)}</td>
                      <td className="text-mono">{formatClock(s.checkOut)}</td>
                      <td className="text-mono">{s.hours}</td>
                      <td className="text-mono">{s.code ?? t(locale, 'letter.noReceipt')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <figure className="letter-qr">
                <div
                  role="img"
                  aria-label={t(locale, 'letter.qrLabel')}
                  // Server-generated SVG from the qrcode package, not user input.
                  dangerouslySetInnerHTML={{ __html: view.qrSvg }}
                />
                <figcaption className="text-small">{t(locale, 'letter.qrLabel')}</figcaption>
              </figure>
            </div>
          </>
        ) : null}

        <p>{t(locale, 'letter.closing')}</p>
        <div className="letter-sign">
          <p>{t(locale, 'letter.sign')}</p>
          <p className="font-semibold">{worker.name}</p>
        </div>
        <p className="letter-footer text-small">{t(locale, 'letter.footer')}</p>
      </article>
    </div>
  );
}

// Worker data comes from the session cookie, so the screen streams into a skeleton and a
// navigation between worker screens shows something at once.
export default function LabourLetterPage(props: Props) {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <LabourLetterScreen {...props} />
    </Suspense>
  );
}
