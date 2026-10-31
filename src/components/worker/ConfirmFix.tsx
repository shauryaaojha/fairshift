'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/ui/Button';
import { useT } from '@/src/i18n/client';
import { hazardVerdictAction } from '@/app/w/actions';

/**
 * The reporter's second key: after a supervisor marks the report fixed, the worker who saw the
 * danger says whether it really is. "No" reopens the report and sends it to the manager.
 */
export function ConfirmFix({ hazardId }: { hazardId: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<'fixed' | 'reopened' | null>(null);
  const [failed, setFailed] = useState(false);

  function answer(verdict: 'fixed' | 'not_fixed') {
    setFailed(false);
    startTransition(async () => {
      const res = await hazardVerdictAction(hazardId, verdict);
      if (!res.ok) {
        setFailed(true);
        return;
      }
      setDone(res.reopened ? 'reopened' : 'fixed');
      router.refresh();
    });
  }

  if (done) {
    return (
      <p role="status" className="text-body font-semibold">
        {t(done === 'fixed' ? 'hazard.verdict.thanksFixed' : 'hazard.verdict.thanksReopened')}
      </p>
    );
  }

  return (
    <section
      aria-labelledby="verdict-q"
      className="flex flex-col gap-3 rounded-[10px] bg-card p-4 shadow-[var(--shadow-paper)]"
    >
      <h2 id="verdict-q" className="text-h2">
        {t('hazard.verdict.ask')}
      </h2>
      <p className="text-small text-muted">{t('hazard.verdict.why')}</p>
      <Button fullWidth disabled={pending} onClick={() => answer('fixed')}>
        {t('hazard.verdict.fixed')}
      </Button>
      <Button variant="secondary" fullWidth disabled={pending} onClick={() => answer('not_fixed')}>
        {t('hazard.verdict.notFixed')}
      </Button>
      {failed ? (
        <p role="alert" className="text-body font-semibold text-escalated">
          {t('hazard.verdict.error')}
        </p>
      ) : null}
    </section>
  );
}
