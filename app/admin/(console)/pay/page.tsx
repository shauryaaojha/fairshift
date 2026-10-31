import { Suspense } from 'react';
import Link from 'next/link';
import { getAdminContext } from '../../_lib/context';
import {
  getPayData,
  getWagesData,
  type PayQueryRow,
  type WageMonth,
  type WageRow,
} from '@/src/server/services/adminPay';
import { PAY_RULE_LABELS, PAY_RULE_LIMITS } from '@/src/server/domain/payRules';
import { LineReveal } from '@/src/components/motion/LineReveal';
import { Stamp, type StampVariant } from '@/src/components/ui/Stamp';
import {
  PayAnswerForm,
  PayRulesForm,
  WagePaymentForm,
  type RuleField,
} from '@/src/components/admin/PayForms';
import { fmtDateTime } from '@/src/components/admin/format';
import type { PayQueryState } from '@/src/server/domain/payQuery';
import type { WageState } from '@/src/server/domain/wagePayment';
import type { PayRules } from '@/src/shared/types';

const REASON: Record<PayQueryRow['reason'], string> = {
  short_pay: 'Got less than the payslip',
  unpaid_overtime: 'Overtime not paid',
  wrong_deduction: 'Wrong deduction',
  late_pay: 'Pay came late',
};

const STATE: Record<PayQueryState, { variant: StampVariant; word: string }> = {
  overdue: { variant: 'escalated', word: 'Overdue' },
  open: { variant: 'hivis', word: 'Open' },
  awaiting_worker: { variant: 'ink', word: 'Answered' },
  settled: { variant: 'cleared', word: 'Settled' },
};

const WAGE_STATE: Record<WageState, { variant: StampVariant; word: string }> = {
  overdue: { variant: 'escalated', word: 'Overdue' },
  due: { variant: 'hivis', word: 'Due' },
  paid: { variant: 'cleared', word: 'Paid' },
};

const STEP: Record<keyof PayRules, number> = {
  dailyHoursLimit: 0.5,
  weeklyHoursLimit: 1,
  otMultiplier: 0.25,
};

const RULE_FIELDS: RuleField[] = (Object.keys(PAY_RULE_LIMITS) as (keyof PayRules)[]).map(
  (key) => ({ key, label: PAY_RULE_LABELS[key], step: STEP[key], ...PAY_RULE_LIMITS[key] }),
);

const rupees = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n)}`;
const describeRules = (r: PayRules) =>
  `after ${r.dailyHoursLimit} h a day or ${r.weeklyHoursLimit} h a week, at ${r.otMultiplier}×`;

function PayQueryCard({ q }: { q: PayQueryRow }) {
  const s = STATE[q.state];
  const waiting = q.state === 'open' || q.state === 'overdue';
  const latest = q.answers.at(-1);
  return (
    <li className="hazard">
      <div className="hazard-top">
        <h3>
          {q.workerName} · {REASON[q.reason]}
        </h3>
        <span className="cell-stamp">
          <Stamp variant={s.variant} id={q.id} animate={false}>
            {s.word}
          </Stamp>
        </span>
      </div>
      <p className="text-small muted">
        {q.team ? `${q.team} · ` : ''}pay for <span className="mono">{q.period}</span> · raised{' '}
        <span className="mono">{fmtDateTime(q.raisedAt)}</span> · wages legally due by{' '}
        <span className="mono">{q.wagesDueBy}</span>
      </p>
      <dl className="pay-figures">
        <div>
          <dt>Payslip</dt>
          <dd>{rupees(q.payslipNet)}</dd>
        </div>
        <div>
          <dt>Worker got</dt>
          <dd>{q.receivedAmount === null ? 'not given' : rupees(q.receivedAmount)}</dd>
        </div>
        {q.gap !== null ? (
          <div>
            <dt>Short by</dt>
            <dd data-short={q.gap > 0 || undefined}>{rupees(Math.max(q.gap, 0))}</dd>
          </div>
        ) : null}
      </dl>
      {q.note ? <p>“{q.note}”</p> : null}
      <p className="sla" data-late={q.state === 'overdue' || undefined}>
        {q.dueLabel}
      </p>
      {q.reopenCount > 0 && waiting ? (
        <p className="closure" data-state="reopened">
          The worker said the last answer did not settle it
          {q.reopenCount > 1 ? ` (${q.reopenCount} times)` : ''}.
        </p>
      ) : null}
      {latest ? (
        <p className="closure" data-state={q.state === 'settled' ? 'confirmed' : undefined}>
          {latest.by}: “{latest.text}”
          {latest.correctedNet !== null ? ` Corrected pay ${rupees(latest.correctedNet)}.` : ''}
        </p>
      ) : null}
      {waiting ? <PayAnswerForm id={q.id} payslipNet={q.payslipNet} /> : null}
    </li>
  );
}

const monthName = (period: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${period}-01T00:00:00Z`),
  );

function WageAction({ row, period }: { row: WageRow; period: string }) {
  if (row.payment) {
    return (
      <>
        UTR <span className="mono">{row.payment.utr}</span>
        <br />
        <span className="text-small muted">
          {rupees(row.payment.amount)} on{' '}
          <span className="mono">{fmtDateTime(row.payment.paidAt)}</span> by {row.payment.paidBy}
        </span>
      </>
    );
  }
  if (!row.payUri || !row.qrSvg) return <span className="muted">No UPI ID on file</span>;
  return (
    <details className="upi-pay">
      <summary>Pay {rupees(row.net)} by UPI</summary>
      <div
        className="upi-qr"
        role="img"
        aria-label={`UPI QR code to pay ${row.workerName} ${rupees(row.net)}`}
        dangerouslySetInnerHTML={{ __html: row.qrSvg }}
      />
      <p className="text-small">
        Scan with any UPI app, or <a href={row.payUri}>open it on this phone</a>. Paying{' '}
        <span className="mono">{row.upiId}</span>.
      </p>
      <WagePaymentForm workerId={row.workerId} period={period} />
    </details>
  );
}

function WageMonthTable({ month }: { month: WageMonth }) {
  return (
    <>
      <h3 className="section-title">
        {monthName(month.period)} · <span className="mono">{month.paidCount}</span> of{' '}
        <span className="mono">{month.rows.length}</span> paid · due by{' '}
        <span className="mono">{month.dueBy}</span>
        {month.overdueCount > 0 ? (
          <>
            {' '}
            · <span className="mono">{month.overdueCount}</span> overdue
          </>
        ) : null}
      </h3>
      <div
        className="table-wrap"
        tabIndex={0}
        role="region"
        aria-label={`Wages for ${monthName(month.period)}`}
      >
        <table className="data-table">
          <caption className="sr-only">
            Take-home pay for {monthName(month.period)} and whether it has been paid
          </caption>
          <thead>
            <tr>
              <th scope="col">Worker</th>
              <th scope="col" className="num">
                Take-home
              </th>
              <th scope="col">Status</th>
              <th scope="col">Payment</th>
            </tr>
          </thead>
          <tbody>
            {month.rows.map((row) => (
              <tr key={row.workerId}>
                <td>
                  {row.workerName}
                  <br />
                  <span className="text-small muted">{row.team}</span>
                </td>
                <td className="num">{rupees(row.net)}</td>
                <td>
                  <Stamp
                    variant={WAGE_STATE[row.state].variant}
                    id={`wage-${row.workerId}-${month.period}`}
                    animate={false}
                  >
                    {WAGE_STATE[row.state].word}
                  </Stamp>
                </td>
                <td className="wrap">
                  <WageAction row={row} period={month.period} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const TABS = [
  { key: 'queries', label: 'Pay queries' },
  { key: 'wages', label: 'Wages' },
  { key: 'rules', label: 'Overtime rules' },
] as const;
type Tab = (typeof TABS)[number]['key'];

function parseTab(tab: string | undefined): Tab {
  return TABS.find((t) => t.key === tab)?.key ?? 'queries';
}

async function Pay({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [ctx, { tab: rawTab }] = await Promise.all([getAdminContext(), searchParams]);
  const tab = parseTab(rawTab);
  const [{ queries, rules }, wages] = await Promise.all([
    getPayData(ctx.sector.key),
    getWagesData(ctx.sector.key),
  ]);
  const waiting = queries.filter((q) => q.state === 'open' || q.state === 'overdue').length;
  const overdueQueries = queries.some((q) => q.state === 'overdue');
  const wagesOverdue = wages.reduce((n, m) => n + m.overdueCount, 0);
  const counts: Partial<Record<Tab, { n: number; urgent: boolean }>> = {
    queries: { n: waiting, urgent: overdueQueries },
    wages: { n: wagesOverdue, urgent: true },
  };

  return (
    <>
      <header className="page-head">
        <p className="text-small muted">
          {ctx.sector.label} · {ctx.sector.place} · Demo data
        </p>
        <LineReveal as="h1" className="page-title" immediate>
          Pay
        </LineReveal>
        <p className="page-sub">
          Workers ask about their pay here. Answer within 2 days; a query closes only when the
          worker says it is settled.
        </p>
        <nav className="page-tabs" aria-label="Pay sections">
          {TABS.map((t) => {
            const c = counts[t.key];
            return (
              <Link
                key={t.key}
                href={t.key === 'queries' ? '/admin/pay' : `/admin/pay?tab=${t.key}`}
                className="page-tab"
                aria-current={tab === t.key ? 'page' : undefined}
              >
                {t.label}
                {c && c.n > 0 ? (
                  <span className="page-tab-count mono" data-urgent={c.urgent || undefined}>
                    {c.n}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </header>

      {tab === 'queries' ? (
        <section className="section" aria-labelledby="queries-title">
          <h2 id="queries-title" className="section-title">
            Pay queries · <span className="mono">{waiting}</span> waiting for you
          </h2>
          {queries.length === 0 ? (
            <p>No pay queries at this site.</p>
          ) : (
            <ul className="hazard-list">
              {queries.map((q) => (
                <PayQueryCard key={q.id} q={q} />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'wages' ? (
        <section className="section" aria-labelledby="wages-title">
          <h2 id="wages-title" className="section-title">
            Wages
          </h2>
          <p>
            Each amount is the worker&apos;s own payslip. Scan the QR to pay it by UPI, then record
            the 12-digit UTR. The worker sees the date and UTR on their payslip. Wages are due by
            the 7th of the next month.
          </p>
          {wages
            .filter((m) => m.rows.length > 0)
            .map((m) => (
              <WageMonthTable key={m.period} month={m} />
            ))}
        </section>
      ) : null}

      {tab === 'rules' ? (
        <section className="section" aria-labelledby="rules-title">
          <h2 id="rules-title" className="section-title">
            Overtime rules
          </h2>
          <p>
            In force today: overtime {describeRules(rules.current)}. Past weeks keep the rules they
            were worked under, so a change never cuts pay already earned.
          </p>
          {rules.scheduled.length > 0 ? (
            <ul>
              {rules.scheduled.map((v) => (
                <li key={v.id}>
                  From Monday <span className="mono">{v.effectiveFrom}</span>: overtime{' '}
                  {describeRules(v.rules)}.
                </li>
              ))}
            </ul>
          ) : null}

          <h3 className="section-title">Schedule a change</h3>
          <PayRulesForm
            fields={RULE_FIELDS}
            current={rules.current}
            startDates={rules.startDates}
          />

          {rules.history.length > 0 ? (
            <>
              <h3 className="section-title">History</h3>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Pay rule history">
                <table className="data-table">
                  <caption className="sr-only">Every pay rule version, newest first</caption>
                  <thead>
                    <tr>
                      <th scope="col">From</th>
                      <th scope="col" className="num">
                        Hours a day
                      </th>
                      <th scope="col" className="num">
                        Hours a week
                      </th>
                      <th scope="col" className="num">
                        Rate
                      </th>
                      <th scope="col">Reason</th>
                      <th scope="col">Changed by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.history.map((v) => (
                      <tr key={v.id}>
                        <td className="mono">{v.effectiveFrom}</td>
                        <td className="num">{v.rules.dailyHoursLimit}</td>
                        <td className="num">{v.rules.weeklyHoursLimit}</td>
                        <td className="num">{v.rules.otMultiplier}×</td>
                        <td className="wrap">{v.reason}</td>
                        <td>
                          {v.changedBy}
                          <br />
                          <span className="text-small muted mono">{fmtDateTime(v.changedAt)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

export default function PayPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return (
    <Suspense fallback={<div aria-busy="true" className="skeleton-line" />}>
      <Pay searchParams={searchParams} />
    </Suspense>
  );
}
