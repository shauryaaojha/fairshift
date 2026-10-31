'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/ui/Button';
import { useT } from '@/src/i18n/client';
import { payQueryVerdictAction } from '@/app/w/actions';

/**
 * The worker's key on an answered pay query. "Not settled" sends it back to the employer with a
 * one-day deadline; only "settled" closes it.
 */
export function PayVerdict({ queryId }: { queryId: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<'settled' | 'reopened' | null>(null);
  const [failed, setFailed] = useState(false);

  function answer(verdict: 'settled' | 'not_settled') {
    setFailed(false);
    startTransition(async () => {
      const res = await payQueryVerdictAction(queryId, verdict);
      if (!res.ok) {
        setFailed(true);
        return;
      }
      setDone(res.reopened ? 'reopened' : 'settled');
      router.refresh();
    });
  }

  if (done) {
    return (
      <p role="status" className="text-body font-semibold">
        {t(done === 'settled' ? 'payq.verdict.thanksSettled' : 'payq.verdict.thanksReopened')}
      </p>
    );
  }

  return (
    <section
      aria-labelledby="pay-verdict-q"
      className="flex flex-col gap-3 rounded-[10px] bg-card p-4 shadow-[var(--shadow-paper)]"
    >
      <h2 id="pay-verdict-q" className="text-h2">
        {t('payq.verdict.ask')}
      </h2>
      <p className="text-small text-muted">{t('payq.verdict.why')}</p>
      <Button fullWidth disabled={pending} onClick={() => answer('settled')}>
        {t('payq.verdict.settled')}
      </Button>
      <Button
        variant="secondary"
        fullWidth
        disabled={pending}
        onClick={() => answer('not_settled')}
      >
        {t('payq.verdict.notSettled')}
      </Button>
      {failed ? (
        <p role="alert" className="text-body font-semibold text-escalated">
          {t('payq.verdict.error')}
        </p>
      ) : null}
    </section>
  );
}
