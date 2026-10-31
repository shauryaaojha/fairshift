import { Suspense } from 'react';
import Link from 'next/link';
import { getAdminContext } from '../../_lib/context';
import { SECTORS } from '@/src/server/services/sectors';
import { getSitesData } from '@/src/server/services/adminPages';
import { LineReveal } from '@/src/components/motion/LineReveal';
import type { ScoreBand, SiteScore } from '@/src/server/domain/siteScore';

const BAND: Record<ScoreBand, string> = {
  good: 'Fair to its workers',
  fair: 'Needs attention',
  poor: 'Needs a visit',
};

function SiteScoreCard({ score, id }: { score: SiteScore; id: string }) {
  if (score.score === null || score.band === null) {
    return <p className="muted">Not enough records yet to score this site.</p>;
  }
  return (
    <div className="site-score" data-band={score.band}>
      <p id={`${id}-score`} className="site-score-total">
        <span className="mono">{score.score}</span>
        <span className="text-small"> / 100 · {BAND[score.band]}</span>
      </p>
      <ul className="site-score-parts">
        {score.parts.map((p) => (
          <li key={p.key}>
            <div className="site-score-head">
              <span>{p.label}</span>
              <span className="mono">{p.value}</span>
            </div>
            <div className="site-score-bar" aria-hidden="true">
              <span style={{ width: `${p.value}%` }} />
            </div>
            <p className="text-small muted">{p.detail}</p>
          </li>
        ))}
      </ul>
      {score.missing.length > 0 ? (
        <p className="text-small muted">
          Not counted:{' '}
          {score.missing
            .map((m) => `${m.label.toLowerCase()} (${m.reason.toLowerCase()})`)
            .join('; ')}
        </p>
      ) : null}
    </div>
  );
}

async function Sites() {
  const ctx = await getAdminContext();
  const groups = await getSitesData(ctx.allowedSectors);

  return (
    <>
      <header className="page-head">
        <p className="text-small muted">Demo data</p>
        <LineReveal as="h1" className="page-title" immediate>
          Sites and gate kiosks
        </LineReveal>
        <p className="page-sub">
          Each site&apos;s fair-site score is the average of five parts, each out of 100, worked out
          from the records below it. Open a kiosk on a tablet or screen at the gate. Its QR code
          changes every 60 seconds, so a photo of it cannot be used later.
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.sector} className="panel section" aria-labelledby={`sites-${g.sector}`}>
          <LineReveal as="h2" className="section-title">
            <span id={`sites-${g.sector}`}>
              {SECTORS[g.sector].label} · {SECTORS[g.sector].place}
              {g.sector === ctx.sector.key ? ' (viewing)' : ''}
            </span>
          </LineReveal>
          <SiteScoreCard score={g.score} id={`sites-${g.sector}`} />
          {g.sites.map((s) => (
            <div key={s.id} className="site-row">
              <div>
                <p>
                  <strong>{s.name}</strong>
                </p>
                <p className="text-small muted">
                  Geofence <span className="mono">{s.radiusMetres} m</span>
                </p>
              </div>
              <Link
                href={`/admin/sites/${encodeURIComponent(s.id)}/kiosk`}
                className="btn-primary btn-small"
                style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
              >
                Open gate kiosk
              </Link>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

export default function SitesPage() {
  return (
    <Suspense fallback={<div aria-busy="true" className="skeleton-line" />}>
      <Sites />
    </Suspense>
  );
}
