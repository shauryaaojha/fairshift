import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Stamp } from '@/src/components/ui/Stamp';
import { PaidCheck } from '@/src/components/worker/PaidCheck';
import { HearPayslipButton, PayActions } from '@/src/components/worker/PayActions';
import { Screen } from '@/src/components/worker/Screen';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import {
  buildPayslipSpeech,
  PAY_QUERY_STAMP,
  formatDay,
  formatMonth,
  formatRupees,
  getLocale,
  listMyPayQueries,
  loadPay,
  requireWorkerContext,
} from '@/src/server/services/workerViews';

const ROW_STEP_MS = 80;

export default async function PayPage() {
  const [ctx, cookieLocale] = await Promise.all([requireWorkerContext(), getLocale()]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  const [payslip, queries] = await Promise.all([
    loadPay(ctx.worker.id),
    listMyPayQueries(ctx.worker.id),
  ]);

  const speech = buildPayslipSpeech(payslip, locale);
  const rows = payslip.lines;
  // The net is stamped after the last row has risen.
  const stampDelay = rows.length * ROW_STEP_MS + 300;

  return (
    <Screen
      title={t(locale, 'pay.title')}
      speakText={speech}
      backLabel={t(locale, 'common.back')}
      transitionName="tile-pay"
      action={<HearPayslipButton speech={speech} />}
    >
      <p className="text-small text-muted">
        {t(locale, 'pay.period', {
          start: formatDay(payslip.periodStart, locale),
          end: formatDay(payslip.periodEnd, locale),
        })}
      </p>

      <section className="rounded-[6px] bg-card p-4 shadow-[var(--shadow-paper)]">
        <ul className="flex flex-col">
          {rows.map((line, i) => {
            const isNet = line.key === 'payslip.net';
            const label = t(locale, line.key);
            return (
              <li
                key={line.key}
                className="payslip-row flex items-baseline justify-between gap-3 py-2"
                style={{ '--i': i } as CSSProperties}
              >
                <span
                  className={
                    isNet
                      ? 'text-h2'
                      : line.type === 'total'
                        ? 'text-body font-semibold'
                        : 'text-body'
                  }
                >
                  {label === line.key ? line.label : label}
                </span>
                <span className={'text-mono shrink-0 ' + (isNet ? 'text-display' : '')}>
                  {line.type === 'deduction' ? '−' : ''}
                  {'₹'}
                  {formatRupees(line.amount)}
                </span>
              </li>
            );
          })}
        </ul>

        {/* The total is underlined by a drawn line, then stamped PAID. */}
        <svg
          viewBox="0 0 100 6"
          preserveAspectRatio="none"
          className="mt-1 h-1.5 w-full text-graphite"
          aria-hidden="true"
        >
          <path
            d="M0 3 H100"
            pathLength={1}
            className="draw-path"
            style={
              {
                '--path-length': 1,
                animationDelay: `${rows.length * ROW_STEP_MS}ms`,
              } as CSSProperties
            }
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
          />
        </svg>

        <div className="mt-4 flex justify-end">
          <Stamp announce variant="cleared" id={`pay-${payslip.periodEnd}`} delayMs={stampDelay}>
            {t(locale, 'pay.paid')}
          </Stamp>
        </div>
      </section>

      <PayActions />
      <PaidCheck net={payslip.net} />

      <section aria-labelledby="pay-queries" className="flex flex-col gap-2">
        <h2 id="pay-queries" className="text-h2">
          {t(locale, 'payq.mine')}
        </h2>
        {queries.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {queries.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/w/pay/query/${q.id}`}
                  className="flex min-h-14 flex-col justify-center rounded-[6px] bg-card px-4 py-2 shadow-[var(--shadow-paper)]"
                >
                  <span className="text-body font-semibold">
                    {t(locale, `payq.reason.${q.reason}`)}
                  </span>
                  <span
                    className={
                      'text-small ' +
                      (q.state === 'awaiting_worker' || q.state === 'overdue'
                        ? 'font-semibold text-escalated'
                        : 'text-muted')
                    }
                  >
                    {t(locale, PAY_QUERY_STAMP[q.state].labelKey)} · {formatMonth(q.period, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-muted">{t(locale, 'payq.none')}</p>
        )}
        <Link href="/w/pay/query" className="min-h-12 font-semibold text-ink underline">
          {t(locale, 'payq.ask')}
        </Link>
      </section>
    </Screen>
  );
}
