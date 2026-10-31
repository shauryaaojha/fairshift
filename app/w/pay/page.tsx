import type { CSSProperties } from 'react';
import { Suspense } from 'react';
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
  loadMyWages,
  loadPay,
  requireWorkerContext,
} from '@/src/server/services/workerViews';
import { ScreenSkeleton } from '@/src/components/worker/ScreenSkeleton';

const ROW_STEP_MS = 80;

async function PayScreen() {
  const [ctx, cookieLocale] = await Promise.all([requireWorkerContext(), getLocale()]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  const [payslip, queries, wages] = await Promise.all([
    loadPay(ctx.worker.id),
    listMyPayQueries(ctx.worker.id),
    loadMyWages(ctx.worker),
  ]);
  // This month is stamped PAID only once the employer has recorded the payment.
  const paidNow = wages[0].payment !== null;

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

      <section className="rounded-[10px] bg-card p-4 shadow-[var(--shadow-paper)]">
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
          <Stamp
            announce
            variant={paidNow ? 'cleared' : 'hivis'}
            id={`pay-${payslip.periodEnd}`}
            delayMs={stampDelay}
          >
            {t(locale, paidNow ? 'pay.paid' : 'pay.due')}
          </Stamp>
        </div>
      </section>

      <section aria-labelledby="wages-paid" className="flex flex-col gap-2">
        <h2 id="wages-paid" className="text-h2">
          {t(locale, 'wage.title')}
        </h2>
        <ul className="flex flex-col gap-2">
          {wages.map((w) => (
            <li
              key={w.period}
              className="rounded-[10px] bg-card px-4 py-3 shadow-[var(--shadow-paper)]"
            >
              {w.payment ? (
                <>
                  <p className="text-body font-semibold">
                    {t(locale, 'wage.paid', {
                      month: formatMonth(w.period, locale),
                      amount: `₹${formatRupees(w.payment.amount)}`,
                      date: formatDay(w.payment.paidAt, locale),
                    })}
                  </p>
                  <p className="text-small">{t(locale, 'wage.utr', { utr: w.payment.utr })}</p>
                </>
              ) : (
                <>
                  <p
                    className={
                      'text-body ' + (w.state === 'overdue' ? 'font-semibold text-escalated' : '')
                    }
                  >
                    {t(locale, w.state === 'overdue' ? 'wage.overdue' : 'wage.due', {
                      month: formatMonth(w.period, locale),
                      date: formatDay(w.dueBy, locale),
                    })}
                  </p>
                  {w.state === 'overdue' ? (
                    <Link href="/w/pay/query" className="min-h-12 font-semibold text-ink underline">
                      {t(locale, 'wage.askLate')}
                    </Link>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
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
                  className="flex min-h-14 flex-col justify-center rounded-[10px] bg-card px-4 py-2 shadow-[var(--shadow-paper)]"
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

// Worker data comes from the session cookie, so the screen streams into a skeleton and a
// navigation between worker screens shows something at once.
export default function PayPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <PayScreen />
    </Suspense>
  );
}
