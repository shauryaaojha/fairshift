'use client';

import { useEffect } from 'react';
import type { Locale } from '@/src/shared/types';

/** The root layout fixes lang="en"; keep <html lang> in step with the chosen language. */
export function HtmlLang({ locale }: { locale: Locale }) {
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.lang;
    el.lang = locale;
    return () => {
      el.lang = prev;
    };
  }, [locale]);
  return null;
}
