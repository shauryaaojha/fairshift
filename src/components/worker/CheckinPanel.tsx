'use client';

import { useEffect, useEffectEvent, useRef, useState, useTransition } from 'react';
import { PinIcon, QrIcon } from '@/src/components/icons';
import { Button, ButtonLink } from '@/src/components/ui/Button';
import { PinPad } from '@/src/components/ui/PinPad';
import { Stamp } from '@/src/components/ui/Stamp';
import { speak, vibrate } from '@/src/components/ui/speech';
import { useLocale, useT } from '@/src/i18n/client';
import { generateUuid, getActiveWorkerId, getOutboxStore } from '@/src/lib/offline/outbox';
import { checkInAction, checkOutAction } from '@/app/w/actions';
import { checkinErrorKey } from '@/src/shared/errors';

type Props = {
  /** hh:mm if the worker is already checked in. */
  activeSince: string | null;
  activeShiftId: string | null;
  /** 6-digit code from a QR scan, if the page was opened from one. */
  initialCode: string | null;
  workerId?: string;
};

type Outcome =
  | { kind: 'in'; time: string; id: string }
  | { kind: 'out'; time: string; id: string }
  | { kind: 'offline'; id: string }
  | null;

export function CheckinPanel({ activeSince, activeShiftId, initialCode, workerId }: Props) {
  const t = useT();
  const locale = useLocale();
  const [code, setCode] = useState(initialCode ?? '');
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'code' | 'gps' | 'out' | null>(
    initialCode && !activeSince ? 'code' : null,
  );
  const [, startTransition] = useTransition();
  const autoRan = useRef(false);

  function confirmIn(time: string, id: string) {
    setOutcome({ kind: 'in', time, id });
    vibrate(15);
    speak(t('checkin.spoken', { time }), locale);
  }

  async function saveOffline(kind: 'checkin' | 'checkout', payload: unknown) {
    const effectiveWorkerId = workerId || getActiveWorkerId();
    const clientId = generateUuid();
    const capturedAt = new Date().toISOString();
    await getOutboxStore().put({
      id: clientId,
      workerId: effectiveWorkerId,
      kind,
      payload,
      capturedAt,
      attempts: 0,
    });
    setOutcome({ kind: 'offline', id: clientId });
    vibrate(15);
  }

  function runCode(value: string) {
    setError(null);
    setBusy('code');
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setBusy(null);
      saveOffline('checkin', { code: value });
      return;
    }
    startTransition(async () => {
      try {
        const res = await checkInAction({ code: value });
        setBusy(null);
        if (res.ok) {
          confirmIn(res.time, res.shiftId);
        } else {
          setError(t(checkinErrorKey(res.code)));
        }
      } catch {
        setBusy(null);
        await saveOffline('checkin', { code: value });
      }
    });
  }

  // Opened from the phone's camera: ?code=123456 checks in once, automatically. An effect event
  // reads the latest props without making the mount-only effect re-run when they change.
  const autoCheckIn = useEffectEvent(() => {
    if (autoRan.current || !initialCode || activeSince) return;
    autoRan.current = true;
    runCode(initialCode);
  });
  useEffect(() => {
    autoCheckIn();
  }, []);

  function runGps() {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError(t('checkin.gpsDenied'));
      return;
    }
    setBusy('gps');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setBusy(null);
          saveOffline('checkin', { lat, lng });
          return;
        }
        startTransition(async () => {
          try {
            const res = await checkInAction({ lat, lng });
            setBusy(null);
            if (res.ok) {
              confirmIn(res.time, res.shiftId);
            } else {
              setError(t(checkinErrorKey(res.code)));
            }
          } catch {
            setBusy(null);
            await saveOffline('checkin', { lat, lng });
          }
        });
      },
      () => {
        setBusy(null);
        setError(t('checkin.gpsDenied'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function runCheckout() {
    setError(null);
    setBusy('out');
    const payload = { shiftId: activeShiftId ?? undefined };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setBusy(null);
      saveOffline('checkout', payload);
      return;
    }
    startTransition(async () => {
      try {
        const res = await checkOutAction();
        setBusy(null);
        if (res.ok) {
          setOutcome({ kind: 'out', time: res.time, id: res.shiftId });
          vibrate(15);
          speak(t('checkin.checkOutSpoken', { time: res.time }), locale);
        } else {
          setError(t('checkin.err.generic'));
        }
      } catch {
        setBusy(null);
        await saveOffline('checkout', payload);
      }
    });
  }

  // Confirmed just now: stamp it.
  if (outcome) {
    if (outcome.kind === 'offline') {
      return (
        <Frame action={<ButtonLink href="/w">{t('checkin.backHome')}</ButtonLink>}>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10">
            <Stamp announce variant="ink" id={outcome.id} className="text-3xl">
              {t('offline.stamp')}
            </Stamp>
            <p className="text-body text-center">{t('offline.queuedNote')}</p>
          </div>
        </Frame>
      );
    }
    return (
      <Frame action={<ButtonLink href="/w">{t('checkin.backHome')}</ButtonLink>}>
        <div className="flex flex-1 items-center justify-center py-10">
          <Stamp
            announce
            variant={outcome.kind === 'in' ? 'ink' : 'cleared'}
            id={outcome.id}
            className="text-3xl"
          >
            {t(outcome.kind === 'in' ? 'checkin.stamp' : 'checkin.checkOutStamp', {
              time: outcome.time,
            })}
          </Stamp>
        </div>
      </Frame>
    );
  }

  // Already on site: show the standing stamp and offer check out.
  if (activeSince) {
    return (
      <Frame
        action={
          <Button variant="primary" disabled={busy === 'out'} onClick={runCheckout}>
            {t('checkin.checkOut')}
          </Button>
        }
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
          <Stamp variant="ink" id={activeShiftId ?? 'active'} animate={false} className="text-3xl">
            {t('checkin.stamp', { time: activeSince })}
          </Stamp>
          <p className="text-body text-center">{t('checkin.already', { time: activeSince })}</p>
        </div>
        {error ? <ErrorLine text={error} /> : null}
      </Frame>
    );
  }

  return (
    <Frame
      action={
        <Button disabled={code.length !== 6 || busy !== null} onClick={() => runCode(code)}>
          {busy === 'code' ? t('common.loading') : t('checkin.withCode')}
        </Button>
      }
    >
      <div className="flex items-start gap-3 rounded-[10px] bg-card p-4 shadow-[var(--shadow-paper)]">
        <span className="shrink-0 text-ink">
          <QrIcon size={36} />
        </span>
        <p className="text-body">{t('checkin.scanHint')}</p>
      </div>
      <h2 className="text-h2">{t('checkin.codeLabel')}</h2>
      <PinPad value={code} onChange={setCode} length={6} disabled={busy !== null} />
      {error ? <ErrorLine text={error} /> : null}
      <Button variant="secondary" fullWidth disabled={busy !== null} onClick={runGps}>
        <PinIcon />
        {busy === 'gps' ? t('checkin.locating') : t('checkin.useGps')}
      </Button>
    </Frame>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className="text-body font-semibold text-escalated">
      {text}
    </p>
  );
}

function Frame({ children, action }: { children: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-2">{children}</div>
      <div className="sticky bottom-0 bg-paper px-4 pb-3 pt-2">{action}</div>
    </div>
  );
}
