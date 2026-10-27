'use client';

import { useSyncExternalStore } from 'react';
import { SpeakerIcon } from '@/src/components/icons';
import { speak, speechSupported } from '@/src/components/ui/speech';
import type { Locale } from '@/src/shared/types';

const subscribe = () => () => {};

/** Speaks a language's own name in that language. Hidden if speech is unsupported. */
export function SpeakName({
  locale,
  text,
  label,
}: {
  locale: Locale;
  text: string;
  label: string;
}) {
  const supported = useSyncExternalStore(subscribe, speechSupported, () => false);
  if (!supported) return null;
  return (
    <button
      type="button"
      aria-label={`${label}: ${text}`}
      onClick={() => speak(text, locale)}
      className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] border-2 border-ink bg-card text-ink"
    >
      <SpeakerIcon />
    </button>
  );
}
