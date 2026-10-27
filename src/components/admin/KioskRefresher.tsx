'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Re-renders the kiosk (new server-generated QR) when the current code
 * expires, and shows the seconds left. The code itself is never computed here.
 */
export function KioskRefresher({ validUntil }: { validUntil: number }) {
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const secs = Math.max(0, Math.ceil((validUntil * 1000 - Date.now()) / 1000));
      setLeft(secs);
      if (secs <= 0) router.refresh();
    };
    tick();
    const id = window.setInterval(tick, 1000);
    // Safety net in case the clock drifts: refresh at least every 60 s.
    const hard = window.setInterval(() => router.refresh(), 60_000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(hard);
    };
  }, [validUntil, router]);

  return (
    <p className="kiosk-timer mono" aria-live="off">
      {left === null ? 'New code in 60 s' : `New code in ${left} s`}
    </p>
  );
}
