'use client';

import { useEffect } from 'react';
import { Button } from '@/src/components/ui/Button';

/** Fallback for any route without its own boundary. The digest links to the server log entry. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[FairShift] Unhandled render error', error.digest ?? error.message);
  }, [error]);

  return (
    <section
      role="alert"
      className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center gap-4 px-4 py-12"
    >
      <h1 className="text-h1">Something went wrong</h1>
      <p className="text-body">Nothing you entered was lost. Try again in a moment.</p>
      {error.digest ? <p className="text-small text-muted text-mono">Ref {error.digest}</p> : null}
      <Button onClick={reset}>Try again</Button>
    </section>
  );
}
