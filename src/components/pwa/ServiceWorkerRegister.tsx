'use client';

import { useEffect } from 'react';

/** Registers the offline-fallback service worker in production builds only. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((err: unknown) => {
      console.warn('[FairShift PWA] Service worker registration failed:', err);
    });
  }, []);
  return null;
}
