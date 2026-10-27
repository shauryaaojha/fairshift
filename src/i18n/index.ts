import { en, type MessageKey, type Messages } from './en';
import { hi } from './hi';
import { ta } from './ta';
import type { Locale } from '../shared/types';

export type { MessageKey, Messages, Locale };

export const LOCALE_COOKIE = 'fs_lang';
export const LOCALES: readonly Locale[] = ['en', 'hi', 'ta'] as const;
export const DEFAULT_LOCALE: Locale = 'en';

export const dictionaries: Record<Locale, Messages> = { en, hi, ta };

/** BCP-47 tags used for speech synthesis, speech recognition and Intl. */
export const SPEECH_LANG: Record<Locale, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
};

export const NATIVE_NAME: Record<Locale, string> = {
  en: 'English',
  hi: 'हिंदी',
  ta: 'தமிழ்',
};

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'hi' || value === 'ta';
}

export function parseLocale(value: string | undefined | null): Locale | null {
  return isLocale(value) ? value : null;
}

export type Params = Record<string, string | number>;

/** Replace `{name}` placeholders. Unknown placeholders are left as written. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Translate against an already-chosen dictionary. Falls back to English, then the key. */
export function translate(messages: Partial<Messages>, key: string, params?: Params): string {
  const raw =
    (messages as Record<string, string | undefined>)[key] ??
    (en as Record<string, string>)[key] ??
    key;
  return interpolate(raw, params);
}

export function t(locale: Locale, key: string, params?: Params): string {
  return translate(dictionaries[locale] ?? en, key, params);
}

export function hasKey(key: string): key is MessageKey {
  return key in en;
}
