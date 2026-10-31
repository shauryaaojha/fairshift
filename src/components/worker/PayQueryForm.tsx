'use client';

import { useId, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/ui/Button';
import { useT } from '@/src/i18n/client';
import { raisePayQueryAction } from '@/app/w/actions';
import { PAY_QUERY_REASONS, parseRupees } from '@/src/shared/payCheck';
import type { PayQueryReason } from '@/src/shared/types';

/**
 * Ask the employer about this month's pay: pick what is wrong, optionally say what came in hand
 * and add a few words. The payslip figure is added on the server, so it cannot be typed wrong.
 */
export function PayQueryForm({
  initialReason,
  initialReceived,
}: {
  initialReason: PayQueryReason;
  initialReceived: string;
}) {
  const t = useT();
  const router = useRouter();
  const id = useId();
  const [reason, setReason] = useState<PayQueryReason>(initialReason);
  const [received, setReceived] = useState(initialReceived);
  const [note, setNote] = useState('');
  const [error, setError] = useState<'amount' | 'send' | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    const amount = received.trim() === '' ? null : parseRupees(received);
    if (received.trim() !== '' && amount === null) {
      setError('amount');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await raisePayQueryAction({
        reason,
        receivedAmount: amount,
        note: note.trim() || null,
        clientId: crypto.randomUUID(),
      });
      if (!res.ok) {
        setError('send');
        return;
      }
      router.push(`/w/pay/query/${res.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-h2 mb-2">{t('payq.reasonLabel')}</legend>
        {PAY_QUERY_REASONS.map((r) => (
          <label
            key={r}
            className="flex min-h-14 items-center gap-3 rounded-[10px] border-2 border-graphite bg-card px-4 py-2 has-[:checked]:bg-ink has-[:checked]:text-paper"
          >
            <input
              type="radio"
              name="reason"
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
              className="size-5 shrink-0"
            />
            <span className="text-body font-semibold">{t(`payq.reason.${r}`)}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-received`} className="text-body">
          {t('payq.receivedLabel')}
        </label>
        <input
          id={`${id}-received`}
          inputMode="decimal"
          autoComplete="off"
          maxLength={14}
          value={received}
          onChange={(e) => setReceived(e.target.value)}
          aria-invalid={error === 'amount' || undefined}
          aria-describedby={error === 'amount' ? `${id}-err` : undefined}
          className="text-mono min-h-14 rounded-[10px] border-2 border-graphite bg-paper px-3 text-[1.25rem]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-note`} className="text-body">
          {t('payq.noteLabel')}
        </label>
        <textarea
          id={`${id}-note`}
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-[10px] border-2 border-graphite bg-paper px-3 py-2 text-body"
        />
      </div>

      {error ? (
        <p id={`${id}-err`} role="alert" className="text-body font-semibold text-escalated">
          {t(error === 'amount' ? 'payq.invalidAmount' : 'payq.error')}
        </p>
      ) : null}

      <Button type="submit" fullWidth disabled={pending}>
        {t(pending ? 'payq.sending' : 'payq.send')}
      </Button>
    </form>
  );
}
