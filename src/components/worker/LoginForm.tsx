'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/src/components/ui/Button';
import { PinPad } from '@/src/components/ui/PinPad';
import { useT } from '@/src/i18n/client';
import { loginAction } from '@/app/w/actions';

/** Two steps on one pad: mobile number (10 digits), then PIN (4 digits). */
export function LoginForm({ next }: { next?: string } = {}) {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'pin'>('phone');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(withPin: string) {
    setError(null);
    startTransition(async () => {
      const res = await loginAction(phone, withPin, next);
      if (res.ok) {
        const destination =
          (res as { redirectTo?: string }).redirectTo ||
          (next && next.startsWith('/w/') && !next.startsWith('//') ? next : '/w');
        router.replace(destination);
        router.refresh();
      } else {
        setError(t('login.wrong'));
        setPin('');
      }
    });
  }

  const onPhone = step === 'phone';
  const complete = onPhone ? phone.length === 10 : pin.length === 4;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-2">
        <h2 className="text-h2" id="login-step">
          {onPhone ? t('login.phoneLabel') : t('login.pinLabel')}
        </h2>
        {onPhone ? (
          <PinPad key="phone" value={phone} onChange={setPhone} length={10} />
        ) : (
          <PinPad
            key="pin"
            value={pin}
            onChange={(v) => {
              setPin(v);
              if (v.length === 4) submit(v);
            }}
            length={4}
            masked
            disabled={pending}
          />
        )}
        {error ? (
          <p role="alert" className="text-body font-semibold text-escalated">
            {error}
          </p>
        ) : null}
        <p className="text-small text-muted">{t('login.demoHint')}</p>
      </div>
      <div className="sticky bottom-0 flex flex-col gap-2 bg-paper px-4 pb-3 pt-2">
        {onPhone ? (
          <Button disabled={!complete} onClick={() => setStep('pin')}>
            {t('login.next')}
          </Button>
        ) : (
          <>
            <Button disabled={!complete || pending} onClick={() => submit(pin)}>
              {t('login.signIn')}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setStep('phone');
                setPin('');
                setError(null);
              }}
            >
              {t('login.changeNumber')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
