'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { en, type Messages } from './en';
import { translate, type Locale, type Params } from './index';

type Ctx = { locale: Locale; messages: Messages };

const I18nContext = createContext<Ctx>({ locale: 'en', messages: en });

/**
 * Hands one locale's dictionary to client components. Only the active
 * language is sent to the phone, never all three.
 */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

export function useT() {
  const { messages } = useContext(I18nContext);
  return useCallback(
    (key: string, params?: Params) => translate(messages, key, params),
    [messages],
  );
}
