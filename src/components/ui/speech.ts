import { SPEECH_LANG, type Locale } from '@/src/i18n';

/** True when this browser can speak text aloud. */
export function speechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  );
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/** Pick the best installed voice for the locale, or null to let the browser choose. */
export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  locale: Locale,
): SpeechSynthesisVoice | null {
  const tag = SPEECH_LANG[locale].toLowerCase();
  const prefix = tag.split('-')[0];
  return (
    voices.find((v) => v.lang.toLowerCase().replace('_', '-') === tag) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
    null
  );
}

/** Speak `text` in the locale voice at rate 0.9. Returns false if unsupported. */
export function speak(text: string, locale: Locale, onEnd?: () => void): boolean {
  if (!speechSupported() || !text.trim()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = SPEECH_LANG[locale];
  utter.rate = 0.9;
  const voice = pickVoice(synth.getVoices(), locale);
  if (voice) utter.voice = voice;
  if (onEnd) {
    utter.onend = onEnd;
    utter.onerror = onEnd;
  }
  synth.speak(utter);
  return true;
}

/** Short haptic tick where supported. */
export function vibrate(ms: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(ms);
  }
}
