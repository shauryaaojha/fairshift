import { Suspense } from 'react';
import { getAdminContext } from '../../_lib/context';
import { LineReveal } from '@/src/components/motion/LineReveal';
import { ConsoleAsk } from '@/src/components/admin/ConsoleAsk';

async function Ask() {
  const ctx = await getAdminContext();
  return (
    <>
      <header className="page-head">
        <p className="text-small muted">
          {ctx.sector.label} · {ctx.sector.place} · Demo data
        </p>
        <LineReveal as="h1" className="page-title" immediate>
          Ask Urima
        </LineReveal>
        <p className="page-sub">
          Plain questions, answered from the same live numbers as the other pages. Each answer links
          to where its numbers came from. Anonymous feedback stays hidden below 3 answers.
        </p>
      </header>
      <ConsoleAsk place={ctx.sector.place} />
    </>
  );
}

export default function AskPage() {
  return (
    <Suspense fallback={<p className="text-body">Opening the console.</p>}>
      <Ask />
    </Suspense>
  );
}
