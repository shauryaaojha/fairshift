import { Suspense } from 'react';
import { getAdminContext } from '../../_lib/context';
import { getFeedbackData } from '@/src/server/services/adminPages';
import { LineReveal } from '@/src/components/motion/LineReveal';
import { FeedbackHeatmap } from '@/src/components/admin/FeedbackHeatmap';

async function Feedback() {
  const ctx = await getAdminContext();
  const { heatmap, comments } = await getFeedbackData(ctx.sector.key);

  return (
    <>
      <header className="page-head">
        <p className="text-small muted">
          {ctx.sector.label} · {ctx.sector.place} · Demo data
        </p>
        <LineReveal as="h1" className="page-title" immediate>
          Anonymous feedback
        </LineReveal>
        <p className="page-sub">
          Answers carry no worker id. A team with fewer than 3 answers stays hidden so nobody can be
          picked out.
        </p>
      </header>

      <div className="panel">
        <FeedbackHeatmap rows={heatmap} />
      </div>

      <section className="section" aria-labelledby="comments-h">
        <LineReveal as="h2" className="section-title">
          <span id="comments-h">Comments</span>
        </LineReveal>
        {comments.length === 0 ? (
          <p className="text-body">No team has enough answers to show comments yet.</p>
        ) : (
          comments.map((c) => (
            <div key={c.team} className="panel" style={{ marginBottom: 16 }}>
              <h3 className="text-h2">{c.team}</h3>
              <ul>
                {c.comments.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
              <p className="ai-label">Names and phone numbers are removed before display.</p>
            </div>
          ))
        )}
      </section>
    </>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div aria-busy="true" className="skeleton-line" />}>
      <Feedback />
    </Suspense>
  );
}
