import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getPassportByToken } from '@/src/server/services/adminPages';
import { Stamp } from '@/src/components/ui/Stamp';
import '@/src/components/admin/admin.css';

export const metadata: Metadata = {
  title: 'Verify a skill | FairShift',
  description: 'Check that a training or experience record was issued through FairShift.',
  robots: { index: false },
};

function fmt(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));
}

async function Passport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getPassportByToken(token);

  if (!view) {
    return (
      <div className="login-page">
        <div className="login-sheet">
          <h1 className="page-title">Record not found</h1>
          <p className="page-sub">
            This link does not match any FairShift skill record. Ask the worker to share the link
            again.
          </p>
          <p className="section">
            <Link href="/" className="link">
              Go to FairShift
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const ok = view.verified && view.status === 'active';
  return (
    <div className="login-page">
      <article className="login-sheet" aria-labelledby="skill-title">
        <p className="text-small muted">Skill passport</p>
        <h1 id="skill-title" className="page-title">
          {view.title}
        </h1>
        <p className="page-sub">
          Held by <strong>{view.holder}</strong>
        </p>

        <div style={{ margin: '24px 0' }}>
          <Stamp
            variant={ok ? 'cleared' : view.status === 'expired' ? 'escalated' : 'hivis'}
            id={token}
          >
            {ok ? 'Verified' : view.status === 'expired' ? 'Expired' : 'Not verified'}
          </Stamp>
        </div>

        <dl className="passport-facts">
          <dt>Issued by</dt>
          <dd>{view.issuer}</dd>
          <dt>Issued on</dt>
          <dd className="mono">{fmt(view.issuedDate)}</dd>
          <dt>Valid until</dt>
          <dd className="mono">{view.expiryDate ? fmt(view.expiryDate) : 'No expiry'}</dd>
        </dl>
        <p className="demo-box">
          Only the first name and this record are shown. Pay, phone and attendance are never shared.
          Demo data.
        </p>
      </article>
    </div>
  );
}

export default function PassportPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<p className="login-page">Checking the record.</p>}>
      <Passport params={params} />
    </Suspense>
  );
}
