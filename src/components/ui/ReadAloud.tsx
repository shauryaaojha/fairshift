'use client';

import { useState, useSyncExternalStore } from 'react';
import { SpeakerIcon } from '@/src/components/icons';
import { useLocale, useT } from '@/src/i18n/client';
import { speak, speechSupported, stopSpeaking } from './speech';

const subscribe = () => () => {};

/**
 * Speaks `text` in the locale voice at rate 0.9. Hidden when the browser
 * has no speechSynthesis. Rendered after hydration so server and client agree.
 */
export function ReadAloud({ text, className = '' }: { text: string; className?: string }) {
  const supported = useSyncExternalStore(subscribe, speechSupported, () => false);
  const locale = useLocale();
  const t = useT();
  const [speaking, setSpeaking] = useState(false);

  if (!supported) return null;

  const label = speaking ? t('common.stopReading') : t('common.readAloud');

  function toggle() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(speak(text, locale, () => setSpeaking(false)));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={speaking}
      className={
        'inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border-2 border-ink ' +
        (speaking ? 'bg-ink text-white ' : 'bg-card text-ink ') +
        className
      }
    >
      <SpeakerIcon />
    </button>
  );
}
