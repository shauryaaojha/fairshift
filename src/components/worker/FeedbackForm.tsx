'use client';

import { useState, useTransition } from 'react';
import { FaceIcon } from '@/src/components/icons';
import { Button, ButtonLink } from '@/src/components/ui/Button';
import { Stamp } from '@/src/components/ui/Stamp';
import { speak, vibrate } from '@/src/components/ui/speech';
import { useLocale, useT } from '@/src/i18n/client';
import { generateUuid, getActiveWorkerId, getOutboxStore } from '@/src/lib/offline/outbox';
import { submitFeedbackAction } from '@/app/w/actions';
import { VoiceTextarea } from './VoiceTextarea';

const QUESTIONS = [
  { field: 'managerRespect', key: 'managerRespect' },
  { field: 'safetyRating', key: 'safety' },
  { field: 'payFairness', key: 'pay' },
  { field: 'workloadRating', key: 'workload' },
] as const;
type Field = (typeof QUESTIONS)[number]['field'];
type Level = 1 | 2 | 3 | 4 | 5;
const LEVELS: Level[] = [1, 2, 3, 4, 5];

type Props = {
  workerId?: string;
  /** The worker's own words, carried over from Urima. */
  initialComment?: string;
};

export function FeedbackForm({ workerId, initialComment }: Props = {}) {
  const t = useT();
  const locale = useLocale();
  const [answers, setAnswers] = useState<Partial<Record<Field, Level>>>({});
  const [comment, setComment] = useState((initialComment ?? '').slice(0, 2000));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [pending, startTransition] = useTransition();

  const complete = QUESTIONS.every((q) => answers[q.field] !== undefined);

  function send() {
    if (!complete) {
      setError(t('feedback.needAll'));
      return;
    }
    setError(null);
    const effectiveWorkerId = workerId || getActiveWorkerId();
    const payload = {
      managerRespect: answers.managerRespect!,
      safetyRating: answers.safetyRating!,
      payFairness: answers.payFairness!,
      workloadRating: answers.workloadRating!,
      comment: comment.trim() || null,
    };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const clientId = generateUuid();
      const capturedAt = new Date().toISOString();
      getOutboxStore()
        .put({
          id: clientId,
          workerId: effectiveWorkerId,
          kind: 'feedback',
          payload,
          capturedAt,
          attempts: 0,
        })
        .then(() => {
          setDone(true);
          setIsOffline(true);
          vibrate(15);
        });
      return;
    }

    startTransition(async () => {
      try {
        const res = await submitFeedbackAction(payload);
        if (res.ok) {
          setDone(true);
          setIsOffline(false);
          vibrate(15);
          speak(t('feedback.thanks'), locale);
        } else {
          setError(
            t(res.code === 'feedback_already_given' ? 'feedback.already' : 'feedback.error'),
          );
        }
      } catch {
        const clientId = generateUuid();
        const capturedAt = new Date().toISOString();
        await getOutboxStore().put({
          id: clientId,
          workerId: effectiveWorkerId,
          kind: 'feedback',
          payload,
          capturedAt,
          attempts: 0,
        });
        setDone(true);
        setIsOffline(true);
        vibrate(15);
      }
    });
  }

  if (done) {
    if (isOffline) {
      return (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-10">
            <Stamp announce variant="ink" id="feedback-offline" className="text-3xl">
              {t('offline.stamp')}
            </Stamp>
            <p className="text-body text-center">{t('offline.queuedNote')}</p>
          </div>
          <div className="sticky bottom-0 bg-paper px-4 pb-3 pt-2">
            <ButtonLink href="/w">{t('checkin.backHome')}</ButtonLink>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-10">
          <Stamp
            announce
            variant="ink"
            id="feedback-received"
            sub={t('feedback.stampSub')}
            className="text-3xl"
          >
            {t('feedback.stamp')}
          </Stamp>
          <p className="text-body text-center">{t('feedback.thanks')}</p>
        </div>
        <div className="sticky bottom-0 bg-paper px-4 pb-3 pt-2">
          <ButtonLink href="/w">{t('checkin.backHome')}</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-5 px-4 pb-4 pt-2">
        <p className="text-body font-semibold">{t('feedback.anon')}</p>

        {QUESTIONS.map((q) => {
          const picked = answers[q.field];
          return (
            <fieldset key={q.field} className="flex flex-col gap-2">
              <legend className="text-h2 mb-1">{t(`feedback.q.${q.key}`)}</legend>
              <div
                role="radiogroup"
                aria-label={t(`feedback.q.${q.key}`)}
                className="grid grid-cols-5 gap-2"
              >
                {LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    role="radio"
                    aria-checked={picked === lvl}
                    aria-label={t(`feedback.face.${lvl}`)}
                    onClick={() => setAnswers((a) => ({ ...a, [q.field]: lvl }))}
                    className="choice flex min-h-14 items-center justify-center rounded-[10px]"
                  >
                    <FaceIcon level={lvl} size={32} />
                  </button>
                ))}
              </div>
              <p className="text-body min-h-8 font-semibold" aria-live="polite">
                {picked ? t(`feedback.face.${picked}`) : ''}
              </p>
            </fieldset>
          );
        })}

        <VoiceTextarea
          id="feedback-comment"
          label={t('feedback.comment')}
          value={comment}
          onChange={setComment}
        />

        {error ? (
          <p role="alert" className="text-body font-semibold text-escalated">
            {error}
          </p>
        ) : null}
      </div>
      <div className="sticky bottom-0 bg-paper px-4 pb-3 pt-2">
        <Button disabled={pending} onClick={send}>
          {t('feedback.send')}
        </Button>
      </div>
    </div>
  );
}
