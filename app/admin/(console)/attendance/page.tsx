import { Suspense } from 'react';
import { getAdminContext } from '../../_lib/context';
import { getAttendanceData } from '@/src/server/services/adminPages';
import { LineReveal } from '@/src/components/motion/LineReveal';
import { AttendanceChart } from '@/src/components/admin/AttendanceChart';
import { fmtDay, fmtTime } from '@/src/components/admin/format';
import { Stamp } from '@/src/components/ui/Stamp';
import { istDateKey } from '@/src/server/domain/time';

type SP = Promise<Record<string, string | string[] | undefined>>;

const pick = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

export async function Attendance({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const status = pick(sp.status) ?? 'all';
  const team = pick(sp.team) ?? 'all';
  const ctx = await getAdminContext();
  const { rows, teams, trend } = await getAttendanceData(ctx.sector.key, { status, team });
  const thisMonth = istDateKey(new Date()).slice(0, 7);

  return (
    <>
      <header className="page-head">
        <p className="text-small muted">
          {ctx.sector.label} · {ctx.sector.place} · Demo data
        </p>
        <LineReveal as="h1" className="page-title" immediate>
          Attendance
        </LineReveal>
      </header>

      <div className="panel">
        <AttendanceChart days={trend} />
      </div>

      <form method="get" className="filters section" aria-labelledby="registers-title">
        <h2 id="registers-title" className="section-title">
          Statutory registers
        </h2>
        <p className="text-small muted">
          Attendance (muster roll) and wage register for {ctx.sector.place}, as CSV. The wage
          register uses the same payslip engine the workers see.
        </p>
        <div className="field">
          <label htmlFor="month">Month</label>
          <input id="month" name="month" type="month" defaultValue={thisMonth} max={thisMonth} />
        </div>
        <button type="submit" className="btn-quiet" formAction="/admin/registers/attendance">
          Download attendance register
        </button>
        <button type="submit" className="btn-quiet" formAction="/admin/registers/wages">
          Download wage register
        </button>
      </form>

      <form method="get" className="filters section" aria-label="Filter attendance">
        <div className="field">
          <label htmlFor="status">Show</label>
          <select id="status" name="status" defaultValue={status}>
            <option value="all">All shifts</option>
            <option value="on-site">On site now</option>
            <option value="over-8">Longer than 8 h</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="team">Team</label>
          <select id="team" name="team" defaultValue={team}>
            <option value="all">All teams</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-quiet">
          Apply filters
        </button>
        <p className="text-small muted">
          <span className="mono">{rows.length}</span> shifts, last 14 days
        </p>
      </form>

      <div
        className="table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Shifts in the last 14 days"
      >
        <table className="data-table">
          <caption className="sr-only">Shifts in the last 14 days</caption>
          <thead>
            <tr>
              <th scope="col">Worker</th>
              <th scope="col">Team</th>
              <th scope="col">Day</th>
              <th scope="col" className="num">
                In
              </th>
              <th scope="col" className="num">
                Out
              </th>
              <th scope="col" className="num">
                Hours
              </th>
              <th scope="col">How</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.shiftId}>
                <th scope="row">{r.workerName}</th>
                <td>{r.team}</td>
                <td>{fmtDay(r.checkIn)}</td>
                <td className="num">{fmtTime(r.checkIn)}</td>
                <td className="num">{fmtTime(r.checkOut)}</td>
                <td className="num">{r.hours === null ? '-' : r.hours.toFixed(1)}</td>
                <td>{r.method}</td>
                <td>
                  {r.onSite ? (
                    <span className="cell-stamp">
                      <Stamp variant="ink" id={r.shiftId} animate={false}>
                        On site
                      </Stamp>
                    </span>
                  ) : (r.hours ?? 0) > 8 ? (
                    <span className="cell-stamp">
                      <Stamp variant="hivis" id={r.shiftId} animate={false}>
                        Overtime
                      </Stamp>
                    </span>
                  ) : (
                    <span className="cell-stamp">
                      <Stamp variant="cleared" id={r.shiftId} animate={false}>
                        Done
                      </Stamp>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AttendancePage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div aria-busy="true" className="skeleton-line" />}>
      <Attendance searchParams={searchParams} />
    </Suspense>
  );
}
