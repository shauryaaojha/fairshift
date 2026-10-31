'use client';

import { useState, useTransition } from 'react';
import { SpeakerIcon } from '@/src/components/icons';
import { Button } from '@/src/components/ui/Button';
import { speak } from '@/src/components/ui/speech';
import { useLocale, useT } from '@/src/i18n/client';
import { explainPayAction } from '@/app/w/actions';

/** "Why this amount?" with a labelled AI explanation, plus "Hear my payslip". */
export function PayActions() {
  const t = useT();
  const locale = useLocale();
  const [result, setResult] = useState<{ text: string; isAi: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function explain() {
    setFailed(false);
    startTransition(async () => {
      const res = await explainPayAction();
      if (res) setResult(res);
      else setFailed(true);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" fullWidth disabled={pending} onClick={explain}>
        {pending ? t('pay.explaining') : t('pay.why')}
      </Button>
      {failed ? (
        <p role="alert" className="text-body font-semibold text-escalated">
          {t('common.tryAgain')}
        </p>
      ) : null}
      {result ? (
        <div aria-live="polite" className="rounded-[10px] bg-card p-4 shadow-[var(--shadow-paper)]">
          <p className="text-body">{result.text}</p>
          <p className="text-small mt-2 text-muted">
            {result.isAi ? t('pay.aiLabel') : t('pay.rulesLabel')}
          </p>
          <button
            type="button"
            onClick={() => speak(result.text, locale)}
            className="mt-2 inline-flex min-h-12 items-center gap-2 font-semibold text-ink"
          >
            <SpeakerIcon />
            {t('common.readAloud')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function HearPayslipButton({ speech }: { speech: string }) {
  const t = useT();
  const locale = useLocale();
  return (
    <Button onClick={() => speak(speech, locale)}>
      <SpeakerIcon />
      {t('pay.hear')}
    </Button>
  );
}
