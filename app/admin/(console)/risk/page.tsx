import { Suspense } from 'react';
import { getAdminContext } from '../../_lib/context';
import { getRiskData } from '@/src/server/services/adminPages';
import { LineReveal } from '@/src/components/motion/LineReveal';
import { RiskTable } from '@/src/components/admin/RiskTable';

type SP = Promise<Record<string, string | string[] | undefined>>;

const pick = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

async function Risk({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filter = pick(sp.filter) ?? 'all';
  const team = pick(sp.team) ?? 'all';
  const ctx = await getAdminContext();
  const { rows, teams } = await getRiskData(ctx.sector.key, { filter, team });

  return (
    <>
      <header className="page-head">
        <p className="text-small muted">
          {ctx.sector.label} · {ctx.sector.place} · Demo data
        </p>
        <LineReveal as="h1" className="page-title" immediate>
          Workforce risk
        </LineReveal>
        <p className="page-sub">
          Every score shows its top reasons. It is a prompt to talk to the person, not a verdict.
        </p>
      </header>

      <form method="get" className="filters" aria-label="Filter workers">
        <div className="field">
          <label htmlFor="filter">Show</label>
          <select id="filter" name="filter" defaultValue={filter}>
            <option value="all">Everyone</option>
            <option value="high">High risk (score over 50)</option>
            <option value="fatigue">Overtime or fatigue</option>
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
          <span className="mono">{rows.length}</span> workers
        </p>
      </form>

      <RiskTable rows={rows} caption="Quit-risk score and top reasons per worker" />
    </>
  );
}

export default function RiskPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div aria-busy="true" className="skeleton-line" />}>
      <Risk searchParams={searchParams} />
    </Suspense>
  );
}
