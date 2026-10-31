'use client';

import { useState, useTransition } from 'react';
import {
  BoltIcon,
  ConeIcon,
  DotsIcon,
  FlameIcon,
  HardHatIcon,
  LadderIcon,
} from '@/src/components/icons';
import { Button, ButtonLink } from '@/src/components/ui/Button';
import { Stamp } from '@/src/components/ui/Stamp';
import { speak, vibrate } from '@/src/components/ui/speech';
import { useLocale, useT } from '@/src/i18n/client';
import { en } from '@/src/i18n/en';
import { generateUuid, getActiveWorkerId, getOutboxStore } from '@/src/lib/offline/outbox';
import { reportHazardAction } from '@/app/w/actions';
import { VoiceTextarea } from './VoiceTextarea';

const CATEGORIES = [
  { key: 'fall', Icon: LadderIcon },
  { key: 'electric', Icon: BoltIcon },
  { key: 'fire', Icon: FlameIcon },
  { key: 'equipment', Icon: HardHatIcon },
  { key: 'other', Icon: DotsIcon },
] as const;

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
type Severity = (typeof SEVERITIES)[number];

type Props = {
  workerId?: string;
  /** Filled in by Urima from what the worker said ("Change details" on its draft). */
  initial?: { category?: string; severity?: string; text?: string };
};

export function HazardForm({ workerId, initial }: Props = {}) {
  const t = useT();
  const locale = useLocale();
  const [category, setCategory] = useState<string | null>(
    CATEGORIES.some((c) => c.key === initial?.category) ? initial!.category! : null,
  );
  const [severity, setSeverity] = useState<Severity>(
    SEVERITIES.find((s) => s === initial?.severity) ?? 'medium',
  );
  const [text, setText] = useState(
    typeof initial?.text === 'string' ? initial.text.slice(0, 2000) : '',
  );
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [pending, startTransition] = useTransition();

  const ready = category !== null && text.trim().length > 0;

  function send() {
    if (!ready || category === null) {
      setError(t('hazard.needMore'));
      return;
    }
    setError(null);
    const effectiveWorkerId = workerId || getActiveWorkerId();
    const payload = {
      // Stored in English so supervisors and the admin console read one vocabulary.
      category: (en as Record<string, string>)[`hazard.cat.${category}`] ?? category,
      description: text.trim(),
      severity,
      anonymous,
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const clientId = generateUuid();
      const capturedAt = new Date().toISOString();
      getOutboxStore()
        .put({
          id: clientId,
          workerId: effectiveWorkerId,
          kind: 'hazard',
          payload,
          capturedAt,
          attempts: 0,
        })
        .then(() => {
          setSentId(clientId);
          setIsOffline(true);
          vibrate(15);
        });
      return;
    }

    startTransition(async () => {
      try {
        const res = await reportHazardAction(payload);
        if (res.ok) {
          setSentId(res.id);
          setIsOffline(false);
          vibrate(15);
          speak(t('hazard.thanks'), locale);
        } else {
          setError(t('hazard.error'));
        }
      } catch {
        const clientId = generateUuid();
        const capturedAt = new Date().toISOString();
        await getOutboxStore().put({
          id: clientId,
          workerId: effectiveWorkerId,
          kind: 'hazard',
          payload,
          capturedAt,
          attempts: 0,
        });
        setSentId(clientId);
        setIsOffline(true);
        vibrate(15);
      }
    });
  }

  if (sentId) {
    if (isOffline) {
      return (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-10">
            <Stamp announce variant="ink" id={sentId} className="text-3xl">
              {t('offline.stamp')}
            </Stamp>
            <p className="text-body text-center">{t('offline.queuedNote')}</p>
          </div>
          <div className="sticky bottom-0 flex flex-col gap-2 bg-paper px-4 pb-3 pt-2">
            <ButtonLink href="/w">{t('checkin.backHome')}</ButtonLink>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-10">
          <Stamp announce variant="hivis" id={sentId} className="text-3xl">
            {t('hazard.stamp.logged')}
          </Stamp>
          <p className="text-body text-center">{t('hazard.thanks')}</p>
        </div>
        <div className="sticky bottom-0 flex flex-col gap-2 bg-paper px-4 pb-3 pt-2">
          <ButtonLink href={`/w/hazard/${sentId}`}>{t('hazard.seeStatus')}</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-5 px-4 pb-4 pt-2">
        <fieldset className="flex flex-col gap-3">
          <legend className="text-h2 mb-2">{t('hazard.pickType')}</legend>
          <div
            role="radiogroup"
            aria-label={t('hazard.pickType')}
            className="grid grid-cols-2 gap-3"
          >
            {CATEGORIES.map(({ key, Icon }) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={category === key}
                onClick={() => setCategory(key)}
                className="choice choice-danger flex min-h-20 flex-col items-start justify-between gap-2 rounded-[10px] p-3 text-start"
              >
                <Icon size={32} />
                <span className="text-label font-semibold leading-snug">
                  {t(`hazard.cat.${key}`)}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <VoiceTextarea
          id="hazard-text"
          label={t('hazard.describe')}
          value={text}
          onChange={setText}
          placeholder={t('hazard.placeholder')}
        />

        <fieldset className="flex flex-col gap-3">
          <legend className="text-h2 mb-2">{t('hazard.severityTitle')}</legend>
          <div
            role="radiogroup"
            aria-label={t('hazard.severityTitle')}
            className="grid grid-cols-2 gap-3"
          >
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={severity === s}
                onClick={() => setSeverity(s)}
                className="choice min-h-14 rounded-[10px] px-3 py-2 text-label font-semibold leading-snug"
              >
                {t(`hazard.sev.${s}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          role="switch"
          aria-checked={anonymous}
          onClick={() => setAnonymous((a) => !a)}
          className="flex min-h-14 items-center justify-between gap-3 rounded-[10px] border-2 border-graphite bg-card px-4 text-start"
        >
          <span className="text-body font-semibold">{t('hazard.anonymous')}</span>
          <span
            aria-hidden="true"
            className={
              'flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-graphite px-0.5 ' +
              (anonymous ? 'justify-end bg-ink' : 'justify-start bg-paper')
            }
          >
            <span className={'h-5 w-5 rounded-full ' + (anonymous ? 'bg-white' : 'bg-graphite')} />
          </span>
        </button>

        {error ? (
          <p role="alert" className="text-body font-semibold text-escalated">
            {error}
          </p>
        ) : null}
      </div>
      <div className="sticky bottom-0 bg-paper px-4 pb-3 pt-2">
        <Button variant="danger" disabled={pending} onClick={send}>
          <ConeIcon />
          {pending ? t('hazard.sending') : t('hazard.send')}
        </Button>
      </div>
    </div>
  );
}
