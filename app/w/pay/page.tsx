import type { CSSProperties } from 'react';
import { Stamp } from '@/src/components/ui/Stamp';
import { HearPayslipButton, PayActions } from '@/src/components/worker/PayActions';
import { Screen } from '@/src/components/worker/Screen';
import { DEFAULT_LOCALE, t } from '@/src/i18n';
import {
  buildPayslipSpeech,
  formatDay,
  formatRupees,
  getLocale,
  loadPay,
  requireWorkerContext,
} from '@/src/server/services/workerViews';

const ROW_STEP_MS = 80;

export default async function PayPage() {
  const [ctx, cookieLocale] = await Promise.all([requireWorkerContext(), getLocale()]);
  const locale = cookieLocale ?? DEFAULT_LOCALE;
  const payslip = await loadPay(ctx.worker.id);

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
    </Screen>
  );
}
