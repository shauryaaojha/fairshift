'use client';

import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import { SpeakerIcon } from '@/src/components/icons';
import { Button } from '@/src/components/ui/Button';
import { speak } from '@/src/components/ui/speech';
import { useLocale, useT } from '@/src/i18n/client';
import { checkPaid, parseRupees, type PayCheck } from '@/src/shared/payCheck';

const rupees = (n: number) => new Intl.NumberFormat('en-IN').format(n);

/**
 * The worker types what they got in hand; the screen says whether it matches the payslip and, if
 * not, by how much and what to do next. Nothing typed here leaves the phone unless the worker
 * chooses to ask the employer about it.
 */
export function PaidCheck({ net }: { net: number }) {
  const t = useT();
  const locale = useLocale();
  const inputId = useId();
  const [value, setValue] = useState('');
  const [result, setResult] = useState<(PayCheck & { received: number }) | null>(null);
  const [invalid, setInvalid] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const received = parseRupees(value);
    setInvalid(received === null);
    setResult(received === null ? null : { ...checkPaid(net, received), received });
  }

  const message = result
    ? t(`pay.check.${result.status}`, { gap: rupees(result.gap), net: rupees(net) })
    : null;

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className="flex flex-col gap-3 rounded-[10px] bg-card p-4 shadow-[var(--shadow-paper)]"
    >
      <h2 id={`${inputId}-title`} className="text-h2">
        {t('pay.check.title')}
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
        <label htmlFor={inputId} className="text-body">
          {t('pay.check.label')}
        </label>
        <input
          id={inputId}
          inputMode="decimal"
          autoComplete="off"
          maxLength={14}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={`${inputId}-note`}
          className="text-mono min-h-14 rounded-[10px] border-2 border-graphite bg-paper px-3 text-[1.25rem]"
        />
        <p id={`${inputId}-note`} className="text-small text-muted">
          {t('pay.check.note')}
        </p>
        <Button type="submit" variant="secondary" fullWidth>
          {t('pay.check.button')}
        </Button>
      </form>
      {invalid ? (
        <p role="alert" className="text-body font-semibold text-escalated">
          {t('pay.check.invalid')}
        </p>
      ) : null}
      {message && result ? (
        <div aria-live="polite" className="flex flex-col gap-2">
          <p
            className={
              'text-body font-semibold ' + (result.status === 'short' ? 'text-escalated' : '')
            }
          >
            {message}
          </p>
          <button
            type="button"
            onClick={() => speak(message, locale)}
            className="inline-flex min-h-12 items-center gap-2 font-semibold text-ink"
          >
            <SpeakerIcon />
            {t('common.readAloud')}
          </button>
          {result.status === 'short' ? (
            <Link
              href={`/w/pay/query?reason=short_pay&received=${result.received}`}
              className="min-h-12 font-semibold text-ink underline"
            >
              {t('pay.check.ask')}
            </Link>
          ) : null}
          {result.status !== 'match' ? (
            <Link href="/w/rights" className="min-h-12 font-semibold text-ink underline">
              {t('pay.check.rights')}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
