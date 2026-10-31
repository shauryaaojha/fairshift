'use client';

import { useActionState } from 'react';
import {
  answerPayQueryAction,
  recordWagePaymentAction,
  schedulePayRulesAction,
  type FormState,
} from '@/app/admin/actions';
import type { PayRules } from '@/src/shared/types';

const INITIAL: FormState = { ok: false };

/** The employer's answer to one pay query, with an optional corrected amount. */
export function PayAnswerForm({ id, payslipNet }: { id: string; payslipNet: number }) {
  const [state, action, pending] = useActionState(answerPayQueryAction, INITIAL);
  return (
    <form action={action} className="pay-form">
      <input type="hidden" name="id" value={id} />
      <div className="field">
        <label htmlFor={`text-${id}`}>Your answer to the worker</label>
        <textarea id={`text-${id}`} name="text" rows={3} minLength={10} maxLength={1000} required />
      </div>
      <div className="field">
        <label htmlFor={`net-${id}`}>Corrected take-home pay in ₹ (leave empty if unchanged)</label>
        <input
          id={`net-${id}`}
          name="correctedNet"
          inputMode="decimal"
          autoComplete="off"
          placeholder={String(payslipNet)}
        />
      </div>
      <p role="status" className={state.ok ? 'form-ok' : 'form-error'}>
        {state.ok ? state.message : (state.error ?? '')}
      </p>
      <button type="submit" className="btn-primary btn-small" disabled={pending}>
        {pending ? 'Sending' : 'Send answer'}
      </button>
    </form>
  );
}

/** After paying by UPI, the employer records the bank's reference so the worker can trace it. */
export function WagePaymentForm({ workerId, period }: { workerId: string; period: string }) {
  const [state, action, pending] = useActionState(recordWagePaymentAction, INITIAL);
  const id = `utr-${workerId}-${period}`;
  return (
    <form action={action} className="pay-form">
      <input type="hidden" name="workerId" value={workerId} />
      <input type="hidden" name="period" value={period} />
      <div className="field">
        <label htmlFor={id}>UTR (12-digit reference after paying)</label>
        <input
          id={id}
          name="utr"
          inputMode="numeric"
          autoComplete="off"
          pattern="\s*\d(\s*\d){11}\s*"
          required
        />
      </div>
      <p role="status" className={state.ok ? 'form-ok' : 'form-error'}>
        {state.ok ? state.message : (state.error ?? '')}
      </p>
      <button type="submit" className="btn-primary btn-small" disabled={pending}>
        {pending ? 'Saving' : 'Mark paid'}
      </button>
    </form>
  );
}

export interface RuleField {
  key: keyof PayRules;
  label: string;
  min: number;
  max: number;
  step: number;
  law: string;
}

/** Schedule new pay rules from a coming Monday. Limits come from the law; the server checks again. */
export function PayRulesForm({
  fields,
  current,
  startDates,
}: {
  fields: RuleField[];
  current: PayRules;
  startDates: string[];
}) {
  const [state, action, pending] = useActionState(schedulePayRulesAction, INITIAL);
  if (startDates.length === 0) {
    return <p>Every Monday in the next four weeks already has a change scheduled.</p>;
  }
  return (
    <form action={action} className="pay-form">
      <div className="pay-form-row">
        {fields.map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={`rule-${f.key}`}>{f.label}</label>
            <input
              id={`rule-${f.key}`}
              name={f.key}
              type="number"
              min={f.min}
              max={f.max}
              step={f.step}
              defaultValue={current[f.key]}
              aria-describedby={`law-${f.key}`}
              required
            />
            <span id={`law-${f.key}`} className="text-small muted">
              {f.min} to {f.max} · {f.law}
            </span>
          </div>
        ))}
        <div className="field">
          <label htmlFor="rule-from">Starts on Monday</label>
          <select id="rule-from" name="effectiveFrom" defaultValue={startDates[0]}>
            {startDates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="rule-reason">Reason (workers and auditors can read it)</label>
        <textarea id="rule-reason" name="reason" rows={2} minLength={10} maxLength={500} required />
      </div>
      <p role="status" className={state.ok ? 'form-ok' : 'form-error'}>
        {state.ok ? state.message : (state.error ?? '')}
      </p>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Scheduling' : 'Schedule the change'}
      </button>
    </form>
  );
}
