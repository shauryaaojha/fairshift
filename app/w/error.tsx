'use client';

import { useEffect } from 'react';
import { Button } from '@/src/components/ui/Button';
import { useT } from '@/src/i18n/client';

/** Worker-route boundary, inside the worker layout so it speaks the worker's language. */
export default function WorkerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error('[FairShift] Worker screen error', error.digest ?? error.message);
  }, [error]);

  return (
    <section role="alert" className="flex flex-1 flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-h1">{t('error.title')}</h1>
      <p className="text-body">{t('error.body')}</p>
      <Button onClick={reset}>{t('common.tryAgain')}</Button>
    </section>
  );
}
