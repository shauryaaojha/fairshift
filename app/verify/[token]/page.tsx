import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { verifyReceipt, type ReceiptView } from '@/src/server/services/receipts';
import { hoursOf } from '@/src/server/domain/overtime';
import { Stamp } from '@/src/components/ui/Stamp';
import '@/src/components/admin/admin.css';

export const metadata: Metadata = {
  title: 'Check a receipt | FairShift',
  description: 'Check that working hours recorded in FairShift have not been changed since.',
  robots: { index: false },
};

const IST = { timeZone: 'Asia/Kolkata' } as const;
const day = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...IST,
  }).format(new Date(iso.length === 10 ? `${iso}T12:00:00+05:30` : iso));
const clock = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', ...IST }).format(
        new Date(iso),
      )
    : 'still open';
const hours = (minutes: number) => `${hoursOf(minutes)} h`;

function NotValid() {
  return (
    <div className="login-page">
      <div className="login-sheet">
        <h1 className="page-title">This receipt is not valid</h1>
        <p className="page-sub">
          It was not issued by FairShift, or the link is incomplete. Ask the worker to share it
          again, or scan the QR code on their letter.
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

function ShiftReceipt({ view }: { view: Extract<ReceiptView, { kind: 'shift' }> }) {
  const { facts, check } = view;
  const minutes = (Date.parse(facts.checkOut) - Date.parse(facts.checkIn)) / 60_000;
  return (
    <article className="login-sheet" aria-labelledby="receipt-title">
      <p className="text-small muted">
        Shift receipt · <span className="mono">{view.code}</span>
      </p>
      <h1 id="receipt-title" className="page-title">
        Hours at {view.site}
      </h1>
      <p className="page-sub">
        Worked by <strong>{view.holder}</strong>
      </p>

      <div style={{ margin: '24px 0' }}>
        <Stamp variant={check.status === 'unchanged' ? 'cleared' : 'escalated'} id={view.code}>
          {check.status === 'unchanged'
            ? 'Unchanged'
            : check.status === 'changed'
              ? 'Changed since'
              : 'Record deleted'}
        </Stamp>
      </div>

      <dl className="passport-facts">
        <dt>Date</dt>
        <dd className="mono">{day(facts.checkIn)}</dd>
        <dt>Checked in</dt>
        <dd className="mono">{clock(facts.checkIn)}</dd>
        <dt>Checked out</dt>
        <dd className="mono">{clock(facts.checkOut)}</dd>
        <dt>Hours</dt>
        <dd className="mono">{hours(minutes)}</dd>
      </dl>

      {view.now ? (
        <p className="section" role="alert">
          The record now says {clock(view.now.checkIn)} to {clock(view.now.checkOut)}. These are not
          the times sealed at check-out.
        </p>
      ) : null}
      {check.status === 'missing' ? (
        <p className="section" role="alert">
          This shift is no longer in the records. The receipt above shows what was recorded.
        </p>
      ) : null}

      <p className="demo-box">
        FairShift sealed these times with its own key when the worker checked out. The seal shows
        whether anyone changed the record since. It proves what was recorded, not what happened on
        site. Demo data.
      </p>
    </article>
  );
}

function PeriodReceipt({ view }: { view: Extract<ReceiptView, { kind: 'period' }> }) {
  const { facts, check } = view;
  const sameCount = check.then.shifts === check.now.shifts;
  const sameMinutes = check.then.minutes === check.now.minutes;
  return (
    <article className="login-sheet" aria-labelledby="receipt-title">
      <p className="text-small muted">
        Hours receipt · <span className="mono">{view.code}</span>
      </p>
      <h1 id="receipt-title" className="page-title">
        Hours worked by {view.holder}
      </h1>
      <p className="page-sub">
        {day(facts.from)} to {day(facts.to)}
      </p>

      <div style={{ margin: '24px 0' }}>
        <Stamp variant={check.intact ? 'cleared' : 'escalated'} id={view.code}>
          {check.intact ? 'Unchanged' : 'Changed since'}
        </Stamp>
      </div>

      <dl className="passport-facts">
        <dt>When sealed</dt>
        <dd className="mono">
          {check.then.shifts} shifts · {hours(check.then.minutes)}
        </dd>
        <dt>On record now</dt>
        <dd className="mono">
          {check.now.shifts} shifts · {hours(check.now.minutes)}
        </dd>
      </dl>

      {!sameCount || !sameMinutes ? (
        <p className="section" role="alert">
          {sameCount
            ? 'The total hours have changed since the receipt was sealed.'
            : 'Shifts have been added or removed since the receipt was sealed.'}
        </p>
      ) : null}
      {check.changed.length > 0 ? (
        <p className="section" role="alert">
          Times changed after check-out on: {check.changed.map((s) => day(s.checkIn)).join(', ')}.
        </p>
      ) : null}
      {check.unsealed.length > 0 ? (
        <p className="section">
          No check-out receipt for: {check.unsealed.map((s) => day(s.checkIn)).join(', ')}.
        </p>
      ) : null}

      <p className="demo-box">
        FairShift sealed these totals with its own key, and each shift when the worker checked out.
        Only a first name is shown here; pay and phone are never shared. Demo data.
      </p>
    </article>
  );
}

async function Receipt({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await verifyReceipt(decodeURIComponent(token));
  if (!view) return <NotValid />;
  return (
    <div className="login-page">
      {view.kind === 'shift' ? <ShiftReceipt view={view} /> : <PeriodReceipt view={view} />}
    </div>
  );
}

export default function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<p className="login-page">Checking the receipt.</p>}>
      <Receipt params={params} />
    </Suspense>
  );
}
