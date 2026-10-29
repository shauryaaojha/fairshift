'use client';

import { useEffect } from 'react';

export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[FairShift] Console error', error.digest ?? error.message);
  }, [error]);

  return (
    <section role="alert" className="panel">
      <h1 className="page-title">This view could not load</h1>
      <p className="page-sub">
        The data store or a service did not answer. The rest of the console still works.
      </p>
      {error.digest ? <p className="text-small muted mono">Ref {error.digest}</p> : null}
      <button type="button" className="btn-primary" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
