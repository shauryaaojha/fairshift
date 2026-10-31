'use client';

import { useEffect, useRef } from 'react';
import { BackspaceIcon, CheckIcon } from '@/src/components/icons';
import { useT } from '@/src/i18n/client';
import { vibrate } from './speech';
import './ui.css';

type PinPadProps = {
  value: string;
  onChange: (next: string) => void;
  /** Number of digits expected (4 for a PIN, 10 for a phone number). */
  length: number;
  /** Show dots instead of digits (PIN). */
  masked?: boolean;
  /** Called when the confirm key is pressed with a full value. */
  onSubmit?: () => void;
  submitLabel?: string;
  disabled?: boolean;
  /** Accept physical keyboard digits and Backspace. Defaults to true. */
  physicalKeys?: boolean;
  className?: string;
};

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** A 3x4 pad of 64 px keys. Also accepts physical keys. */
export function PinPad({
  value,
  onChange,
  length,
  masked = false,
  onSubmit,
  submitLabel,
  disabled = false,
  physicalKeys = true,
  className = '',
}: PinPadProps) {
  const t = useT();
  // Keep the latest props visible to the single window listener.
  const latest = useRef({ value, onChange, length, disabled });
  useEffect(() => {
    latest.current = { value, onChange, length, disabled };
  });

  useEffect(() => {
    if (!physicalKeys) return;
    function onKey(e: KeyboardEvent) {
      const { value: v, onChange: change, length: max, disabled: off } = latest.current;
      if (off || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (/^\d$/.test(e.key)) {
        if (v.length < max) change(v + e.key);
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        change(v.slice(0, -1));
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [physicalKeys]);

  function press(d: string) {
    if (disabled || value.length >= length) return;
    vibrate(10);
    onChange(value + d);
  }
  function back() {
    if (disabled) return;
    vibrate(10);
    onChange(value.slice(0, -1));
  }

  const cells = Array.from({ length }, (_, i) => value[i] ?? '');
  const complete = value.length === length;

  return (
    <div className={className}>
      <output
        aria-live="polite"
        aria-label={t('pad.entered', { n: value.length, total: length })}
        data-testid="pin-display"
        className={length > 6 ? 'mb-4 grid gap-1.5' : 'mb-4 flex flex-wrap justify-center gap-2'}
        style={
          length > 6 ? { gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` } : undefined
        }
      >
        {cells.map((c, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={
              'flex h-12 items-center justify-center rounded-[6px] border-2 border-graphite bg-card font-mono text-xl tabular-nums ' +
              (length > 6 ? 'min-w-0' : 'w-12')
            }
          >
            {c ? (masked ? '●' : c) : ''}
          </span>
        ))}
      </output>
      <div className="grid grid-cols-3 gap-3" role="group">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            className="pin-key"
            disabled={disabled}
            aria-label={t('pad.key', { n: d })}
            onClick={() => press(d)}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className="pin-key pin-key-action"
          disabled={disabled || value.length === 0}
          aria-label={t('pad.delete')}
          onClick={back}
        >
          <BackspaceIcon size={28} />
        </button>
        <button
          type="button"
          className="pin-key"
          disabled={disabled}
          aria-label={t('pad.key', { n: '0' })}
          onClick={() => press('0')}
        >
          0
        </button>
        {onSubmit ? (
          <button
            type="button"
            className="pin-key pin-key-submit"
            disabled={disabled || !complete}
            aria-label={submitLabel ?? t('login.next')}
            onClick={onSubmit}
          >
            <CheckIcon size={28} />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
