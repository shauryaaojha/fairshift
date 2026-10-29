'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MicIcon } from '@/src/components/icons';
import { SPEECH_LANG } from '@/src/i18n';
import { useLocale, useT } from '@/src/i18n/client';

type RecognitionResult = { 0: { transcript: string }; isFinal: boolean; length: number };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

/** Chrome on Android exposes the Web Speech API under a webkit prefix. */
type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionCtor;
  webkitSpeechRecognition?: RecognitionCtor;
};

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w: SpeechWindow = window;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function subscribeOnline(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getCanListen(): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  return getCtor() !== null;
}

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
};

/**
 * A text box with a mic. Voice uses the Web Speech API in the worker's
 * language (hi-IN, ta-IN, en-IN). The mic is hidden where it is unsupported.
 */
export function VoiceTextarea({
  id,
  label,
  value,
  onChange,
  placeholder,
  maxLength = 2000,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const canListen = useSyncExternalStore(subscribeOnline, getCanListen, () => false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const baseRef = useRef('');

  useEffect(() => {
    if (!canListen && listening) {
      recRef.current?.stop();
    }
  }, [canListen, listening]);

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = SPEECH_LANG[locale];
    rec.interimResults = true;
    rec.continuous = false;
    baseRef.current = value ? value.replace(/\s+$/, '') + ' ' : '';
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      onChange((baseRef.current + text).slice(0, maxLength));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-h2">
        {label}
      </label>
      <textarea
        id={id}
        className="field-textarea"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {canListen ? (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={listening}
          className={
            'choice inline-flex min-h-14 items-center justify-center gap-2 rounded-[10px] px-4 font-semibold'
          }
        >
          <MicIcon />
          {listening ? t('hazard.listening') : t('hazard.mic')}
        </button>
      ) : null}
    </div>
  );
}
