'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { reportHazardAction } from '@/app/w/actions';
import { Button, ButtonLink } from '@/src/components/ui/Button';
import { vibrate } from '@/src/components/ui/speech';
import { useT } from '@/src/i18n/client';
import { en } from '@/src/i18n/en';
import type { ActionDraft } from '@/src/server/assistant/drafts';

/**
 * A report or feedback Urima filled in. Nothing is filed until the worker presses Send, and Send
 * goes through the same action as the hazard form, so the server checks it the same way.
 */
export function AskDraft({ draft }: { draft: ActionDraft }) {
  const t = useT();
  const [anonymous, setAnonymous] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  if (draft.kind === 'feedback') {
    return (
      <ButtonLink href={`/w/feedback?comment=${encodeURIComponent(draft.comment)}`}>
        {t('ask.draft.openFeedback')}
      </ButtonLink>
    );
  }

  if (sentId) {
    return (
      <div className="ask-draft" role="status">
        <p className="text-body font-semibold">{t('ask.draft.sent')}</p>
        <Link href={`/w/hazard/${sentId}`} className="ask-chip self-start">
          {t('ask.draft.view')}
        </Link>
      </div>
    );
  }

  const edit = new URLSearchParams({
    category: draft.category,
    severity: draft.severity,
    text: draft.description,
  });

  function send() {
    if (draft.kind !== 'hazard') return;
    setError(false);
    startTransition(async () => {
      try {
        const res = await reportHazardAction({
          // Stored in English like the form does, so the console reads one language.
          category: (en as Record<string, string>)[`hazard.cat.${draft.category}`],
          description: draft.description,
          severity: draft.severity,
          anonymous,
        });
        if (res.ok) {
          setSentId(res.id);
          vibrate(15);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      }
    });
  }

  return (
    <div className="ask-draft">
      <p className="text-small font-semibold">{t('ask.draft.title')}</p>
      <dl className="ask-draft-fields">
        <dt className="sr-only">{t('hazard.pickType')}</dt>
        <dd className="font-semibold">{t(`hazard.cat.${draft.category}`)}</dd>
        <dt className="sr-only">{t('hazard.severityTitle')}</dt>
        <dd className="font-semibold">{t(`hazard.sev.${draft.severity}`)}</dd>
      </dl>
      <p className="text-body">“{draft.description}”</p>
      <p className="text-small text-muted">
        {t('ask.draft.deadline', { hours: draft.deadlineHours })}
      </p>
      <label className="flex min-h-12 items-center gap-3 text-body">
        <input
          type="checkbox"
          className="h-6 w-6"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
        />
        {t('hazard.anonymous')}
      </label>
      {error ? (
        <p role="alert" className="text-body font-semibold text-escalated">
          {t('hazard.error')}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button type="button" onClick={send} disabled={pending}>
          {t('ask.draft.send')}
        </Button>
        <Link href={`/w/hazard?${edit.toString()}`} className="ask-chip self-start">
          {t('ask.draft.edit')}
        </Link>
      </div>
    </div>
  );
}
