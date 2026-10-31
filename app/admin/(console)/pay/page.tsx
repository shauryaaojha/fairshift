import { Suspense } from 'react';
import { getAdminContext } from '../../_lib/context';
import { getPayData, type PayQueryRow } from '@/src/server/services/adminPay';
import { PAY_RULE_LABELS, PAY_RULE_LIMITS } from '@/src/server/domain/payRules';
import { LineReveal } from '@/src/components/motion/LineReveal';
import { Stamp, type StampVariant } from '@/src/components/ui/Stamp';
import { PayAnswerForm, PayRulesForm, type RuleField } from '@/src/components/admin/PayForms';
import { fmtDateTime } from '@/src/components/admin/format';
import type { PayQueryState } from '@/src/server/domain/payQuery';
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

const STEP: Record<keyof PayRules, number> = {
  dailyHoursLimit: 0.5,
  weeklyHoursLimit: 1,
  otMultiplier: 0.25,
};

const RULE_FIELDS: RuleField[] = (Object.keys(PAY_RULE_LIMITS) as (keyof PayRules)[]).map(
  (key) => ({ key, label: PAY_RULE_LABELS[key], step: STEP[key], ...PAY_RULE_LIMITS[key] }),
);

const rupees = (n: number) => `₹${new Intl.NumberFormat('en-IN').format(n)}`;
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

async function Pay() {
  const ctx = await getAdminContext();
  const { queries, rules } = await getPayData(ctx.sector.key);
  const waiting = queries.filter((q) => q.state === 'open' || q.state === 'overdue').length;

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
      </header>

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
        <PayRulesForm fields={RULE_FIELDS} current={rules.current} startDates={rules.startDates} />

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
    </>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<div aria-busy="true" className="skeleton-line" />}>
      <Pay />
    </Suspense>
  );
}
