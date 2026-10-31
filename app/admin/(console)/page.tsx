import { Suspense } from 'react';
import Link from 'next/link';
import { getAdminContext } from '../_lib/context';
import { buildStateSegments } from '@/src/server/services/adminRows';
import { getOverviewData } from '@/src/server/services/adminPages';
import { LineReveal } from '@/src/components/motion/LineReveal';
import { StateSentence } from '@/src/components/admin/StateSentence';
import { AttendanceChart } from '@/src/components/admin/AttendanceChart';
import { FeedbackHeatmap } from '@/src/components/admin/FeedbackHeatmap';
import { RiskTable } from '@/src/components/admin/RiskTable';
import { StatusStamp } from '@/src/components/admin/StatusStamp';
import { HeatBanner } from '@/src/components/admin/HeatBanner';
import { NeedsAction } from '@/src/components/admin/NeedsAction';
import { fmtDateTime } from '@/src/components/admin/format';

async function Overview() {
  const ctx = await getAdminContext();
  const data = await getOverviewData(ctx.sector.key);
  const { kpis } = data;

  return (
    <>
      <header className="page-head">
        <p className="text-small muted">
          {ctx.sector.label} · {ctx.sector.place} · Demo data
        </p>
        <LineReveal as="h1" className="page-title" immediate>
          Today on site
        </LineReveal>
      </header>

      <StateSentence segments={buildStateSegments(kpis)} />
      <NeedsAction items={data.actions} />
      <HeatBanner heat={data.heat} place={ctx.sector.place} />

      <div className="grid-2 section">
        <section aria-labelledby="att-h" className="panel">
          <LineReveal as="h2" className="section-title">
            <span id="att-h">Attendance, last 14 days</span>
          </LineReveal>
          <AttendanceChart days={data.trend} />
        </section>

        <section aria-labelledby="esc-h" className="panel">
          <LineReveal as="h2" className="section-title">
            <span id="esc-h">Escalated hazards</span>
          </LineReveal>
          {data.escalated.length === 0 ? (
            <p className="text-body">No hazard has missed its deadline.</p>
          ) : (
            <ul className="hazard-list">
              {data.escalated.map((h) => (
                <li key={h.id} className="site-row">
                  <div>
                    <p>
                      <strong>{h.category}</strong>
                    </p>
                    <p className="text-small muted">
                      <span className="mono">{fmtDateTime(h.reportedAt)}</span> · {h.slaLabel}
                    </p>
                  </div>
                  <StatusStamp status={h.liveStatus} id={h.id} />
                </li>
              ))}
            </ul>
          )}
          <p className="section">
            <Link className="link" href="/admin/safety">
              Open the safety queue
            </Link>
          </p>
        </section>
      </div>

      <section className="section" aria-labelledby="risk-h">
        <LineReveal as="h2" className="section-title">
          <span id="risk-h">Who may leave, and why</span>
        </LineReveal>
        <RiskTable
          rows={data.risk.slice(0, 5)}
          caption="Workers with the highest quit-risk score"
        />
        <p className="text-small muted">
          Score 0 to 100 from overtime, fatigue, attendance, open complaints and team feedback.{' '}
          <Link className="link" href="/admin/risk">
            See everyone
          </Link>
        </p>
      </section>

      <div className="grid-2 section">
        <section aria-labelledby="fb-h" className="panel">
          <LineReveal as="h2" className="section-title">
            <span id="fb-h">What teams say (anonymous)</span>
          </LineReveal>
          <FeedbackHeatmap rows={data.heatmap} />
        </section>

        <section aria-labelledby="sum-h" className="panel">
          <LineReveal as="h2" className="section-title">
            <span id="sum-h">AI summary of this week</span>
          </LineReveal>
          <p className="summary-text">{data.summary.summary}</p>
          <p className="ai-label">
            {data.summary.isAi
              ? 'Explained by AI · check with supervisor'
              : 'Rule-based summary (AI is off). Numbers come from the same data.'}
          </p>
        </section>
      </div>
    </>
  );
}

export default function OverviewPage() {
  return (
    <Suspense
      fallback={
        <div aria-busy="true">
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
      }
    >
      <Overview />
    </Suspense>
  );
}
