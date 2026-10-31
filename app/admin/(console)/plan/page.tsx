import { Suspense } from 'react';
import { getAdminContext } from '../../_lib/context';
import {
  checkPlannedShift,
  listPlanWorkers,
  type PlanOutcome,
} from '@/src/server/services/adminPlan';
import { PLAN_AHEAD_DAYS } from '@/src/server/domain/shiftPlan';
import { DAY_MS, istDateKey } from '@/src/server/domain/time';
import { LineReveal } from '@/src/components/motion/LineReveal';
import { Stamp, type StampVariant } from '@/src/components/ui/Stamp';
import { fmtDateTime } from '@/src/components/admin/format';
import type { FatigueFlag } from '@/src/shared/types';

type SP = Promise<Record<string, string | string[] | undefined>>;

const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

const VERDICT: Record<'ok' | 'risky' | 'clash', { variant: StampVariant; word: string }> = {
  ok: { variant: 'cleared', word: 'Safe to plan' },
  risky: { variant: 'hivis', word: 'Fatigue risk' },
  clash: { variant: 'escalated', word: 'Clashes' },
};

/** Console wording for a fatigue warning the planned shift would add. */
function describeFlag(flag: FatigueFlag): string {
  const p = flag.params;
  switch (flag.type) {
    case 'long_shift':
      return `The shift is ${p.hours} hours, over the safe limit of 10.`;
    case 'weekly_hours_exceeded':
      return `It takes the worker to ${p.totalHours} hours in 7 days, over ${p.limit}.`;
    case 'short_rest':
      return `Only ${p.gapHours} hours of rest before it; at least ${p.minGap} are needed.`;
    case 'no_rest_day':
      return `It makes ${p.consecutiveDays} days in a row without a day off.`;
    default:
      return 'It adds a fatigue warning.';
  }
}

function Result({ outcome }: { outcome: PlanOutcome }) {
  if (!outcome.ok) {
    return (
      <p role="alert" className="form-error">
        {outcome.error}
      </p>
    );
  }
  const { worker, result } = outcome;
  const v = VERDICT[result.verdict];
  const rupees = new Intl.NumberFormat('en-IN').format(result.extraOvertimePay);
  return (
    <section className="hazard" aria-labelledby="plan-result" aria-live="polite">
      <div className="hazard-top">
        <h2 id="plan-result">
          {worker.name} · {result.hours} h shift
        </h2>
        <span className="cell-stamp">
          <Stamp variant={v.variant} id="plan-verdict" animate={false}>
            {v.word}
          </Stamp>
        </span>
      </div>
      {result.clashes.length > 0 ? (
        <ul>
          {result.clashes.map((s) => (
            <li key={s.id} className="closure" data-state="reopened">
              Overlaps a shift from <span className="mono">{fmtDateTime(s.checkIn)}</span> to{' '}
              <span className="mono">
                {s.checkOut ? fmtDateTime(s.checkOut) : 'now (still on site)'}
              </span>
              .
            </li>
          ))}
        </ul>
      ) : null}
      {result.newFlags.length > 0 ? (
        <ul>
          {result.newFlags.map((f) => (
            <li key={`${f.type}-${String(f.params.date ?? '')}`} className="closure">
              {describeFlag(f)}
            </li>
          ))}
        </ul>
      ) : null}
      {result.verdict === 'ok' ? <p>No new fatigue warnings and no clashes.</p> : null}
      <p>
        Overtime it adds that week: <span className="mono">{result.extraOvertimeHours}</span> h,
        about <span className="mono">₹{rupees}</span> at the overtime rate in force that week.
      </p>
      <p className="text-small muted">Nothing is saved. This only checks the plan.</p>
    </section>
  );
}

async function Plan({ searchParams }: { searchParams: SP }) {
  const [sp, ctx] = await Promise.all([searchParams, getAdminContext()]);
  const workers = await listPlanWorkers(ctx.sector.key);
  const now = new Date();
  const today = istDateKey(now);
  const last = istDateKey(new Date(now.getTime() + PLAN_AHEAD_DAYS * DAY_MS));

  const workerId = str(sp.worker);
  const date = str(sp.date) || today;
  const start = str(sp.start) || '09:00';
  const end = str(sp.end) || '17:00';
  const outcome = workerId
    ? await checkPlannedShift(ctx.sector.key, { workerId, date, start, end }, now)
    : null;

  return (
    <>
      <header className="page-head">
        <p className="text-small muted">
          {ctx.sector.label} · {ctx.sector.place} · Demo data
        </p>
        <LineReveal as="h1" className="page-title" immediate>
          Plan a shift
        </LineReveal>
        <p className="page-sub">
          Before you give someone one more shift, see what it does: new fatigue warnings, clashes
          and the overtime it costs.
        </p>
      </header>

      <form method="get" className="filters" aria-label="Shift to check">
        <div className="field">
          <label htmlFor="worker">Worker</label>
          <select id="worker" name="worker" defaultValue={workerId} required>
            <option value="" disabled>
              Choose a worker
            </option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.team ? ` · ${w.team}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="date">Day</label>
          <input
            id="date"
            name="date"
            type="date"
            min={today}
            max={last}
            defaultValue={date}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="start">Starts</label>
          <input id="start" name="start" type="time" defaultValue={start} required />
        </div>
        <div className="field">
          <label htmlFor="end">Ends</label>
          <input id="end" name="end" type="time" defaultValue={end} required />
        </div>
        <button type="submit" className="btn-primary">
          Check this shift
        </button>
      </form>

      {outcome ? <Result outcome={outcome} /> : null}
    </>
  );
}

export default function PlanPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div aria-busy="true" className="skeleton-line" />}>
      <Plan searchParams={searchParams} />
    </Suspense>
  );
}
