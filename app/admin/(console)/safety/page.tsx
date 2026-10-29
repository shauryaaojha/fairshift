import { Suspense } from 'react';
import { getAdminContext } from '../../_lib/context';
import { getSafetyData } from '@/src/server/services/adminPages';
import { LineReveal } from '@/src/components/motion/LineReveal';
import { HazardCard } from '@/src/components/admin/HazardCard';

type SP = Promise<Record<string, string | string[] | undefined>>;

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'reported', label: 'Logged' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

async function Safety({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const status = typeof sp.status === 'string' ? sp.status : 'open';
  const ctx = await getAdminContext();
  const { rows, total } = await getSafetyData(ctx.sector.key, status);

  return (
    <>
      <header className="page-head">
        <p className="text-small muted">
          {ctx.sector.label} · {ctx.sector.place} · Demo data
        </p>
        <LineReveal as="h1" className="page-title" immediate>
          Safety queue
        </LineReveal>
        <p className="page-sub">
          Most urgent first. A hazard that is not acknowledged in time escalates by itself. AI
          suggests a severity; you confirm it.
        </p>
      </header>

      <form method="get" className="filters" role="search" aria-label="Filter hazards">
        <div className="field">
          <label htmlFor="status">Show</label>
          <select id="status" name="status" defaultValue={status}>
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-quiet">
          Apply filter
        </button>
        <p className="text-small muted">
          <span className="mono">{rows.length}</span> of <span className="mono">{total}</span>{' '}
          reports
        </p>
      </form>

      {rows.length === 0 ? (
        <p className="text-body">No hazards match this filter.</p>
      ) : (
        <ul className="hazard-list">
          {rows.map((h) => (
            <HazardCard key={h.id} h={h} />
          ))}
        </ul>
      )}
    </>
  );
}

export default function SafetyPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<div aria-busy="true" className="skeleton-line" />}>
      <Safety searchParams={searchParams} />
    </Suspense>
  );
}
