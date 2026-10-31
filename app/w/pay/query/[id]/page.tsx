import { ButtonLink } from '@/src/components/ui/Button';
import { Stamp } from '@/src/components/ui/Stamp';
import { PayVerdict } from '@/src/components/worker/PayVerdict';
import { Screen } from '@/src/components/worker/Screen';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import {
  PAY_QUERY_STAMP,
  formatClock,
  formatDay,
  formatMonth,
  formatRupees,
  getLocale,
  loadPayQuery,
  requireWorkerContext,
} from '@/src/server/services/workerViews';
import { wagesDueBy } from '@/src/server/domain/payQuery';
import type { Locale } from '@/src/shared/types';

const when = (iso: string, locale: Locale) => `${formatDay(iso, locale)} ${formatClock(iso)}`;

export default async function PayQueryStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, ctx, cookieLocale] = await Promise.all([
    params,
    requireWorkerContext(),
    getLocale(),
  ]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  const back = t(locale, 'common.back');
  const q = await loadPayQuery(ctx.worker.id, id);

  if (!q) {
    return (
      <Screen
        title={t(locale, 'payq.title')}
        speakText={t(locale, 'payq.notFound')}
        backLabel={back}
        backHref="/w/pay"
        action={<ButtonLink href="/w">{t(locale, 'common.home')}</ButtonLink>}
      >
        <p role="alert" className="text-body">
          {t(locale, 'payq.notFound')}
        </p>
      </Screen>
    );
  }

  const stamp = PAY_QUERY_STAMP[q.state];
  const status = t(locale, stamp.labelKey);
  const askVerdict = q.state === 'awaiting_worker';
  const waiting = q.state === 'open' || q.state === 'overdue';

  return (
    <Screen
      title={t(locale, 'payq.title')}
      speakText={
        t(locale, 'payq.statusSpeak', { status }) +
        (askVerdict ? ' ' + t(locale, 'payq.verdict.ask') : '')
      }
      backLabel={back}
      backHref="/w/pay"
    >
      <section className="flex flex-col gap-2 rounded-[6px] bg-card p-4 shadow-[var(--shadow-paper)]">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-h2 min-w-0">{t(locale, `payq.reason.${q.reason}`)}</h2>
          <Stamp variant={stamp.variant} id={q.id}>
            {status}
          </Stamp>
        </div>
        <p className="text-small text-muted">
          {formatMonth(q.period, locale)} ·{' '}
          {t(locale, 'payq.raised', { date: when(q.raisedAt, locale) })}
        </p>
        <p className="text-body">
          {t(locale, 'payq.payslip', { amount: formatRupees(q.payslipNet) })}
        </p>
        {q.receivedAmount !== null ? (
          <p className="text-body">
            {t(locale, 'payq.received', { amount: formatRupees(q.receivedAmount) })}
          </p>
        ) : null}
        {q.note ? <p className="text-body">“{q.note}”</p> : null}
        {waiting ? (
          <p
            className={'text-body font-semibold ' + (q.state === 'overdue' ? 'text-escalated' : '')}
          >
            {t(locale, 'payq.dueBy', { date: when(q.answerDueAt, locale) })}
          </p>
        ) : null}
        <p className="text-small text-muted">
          {t(locale, 'payq.wagesDue', {
            month: formatMonth(q.period, locale),
            date: formatDay(wagesDueBy(q.period), locale),
          })}
        </p>
      </section>

      {q.answers.length > 0 ? (
        <ol className="flex flex-col gap-2" aria-label={t(locale, 'payq.answers')}>
          {q.answers.map((a) => (
            <li
              key={a.at}
              className="flex flex-col gap-1 rounded-[6px] border-2 border-graphite bg-card p-4"
            >
              <p className="text-small text-muted">
                {t(locale, 'payq.answerFrom', { name: a.by })} · {when(a.at, locale)}
              </p>
              <p className="text-body">{a.text}</p>
              {a.correctedNet !== null ? (
                <p className="text-body font-semibold">
                  {t(locale, 'payq.corrected', { amount: formatRupees(a.correctedNet) })}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {q.reopenCount > 0 && q.state !== 'settled' ? (
        <p className="text-body">{t(locale, 'payq.saidNotSettled')}</p>
      ) : null}

      {askVerdict ? <PayVerdict queryId={q.id} /> : null}
    </Screen>
  );
}
