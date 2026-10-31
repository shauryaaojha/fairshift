'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { askAction } from '@/app/w/actions';
import { ReadAloud } from '@/src/components/ui/ReadAloud';
import { Button } from '@/src/components/ui/Button';
import { VoiceTextarea } from '@/src/components/worker/VoiceTextarea';
import { AskDraft } from '@/src/components/worker/AskDraft';
import { useT } from '@/src/i18n/client';
import { ASK_MAX_HISTORY, ASK_MAX_QUESTION } from '@/src/shared/limits';
import type { AssistantSource } from '@/src/server/assistant/engine';
import type { ActionDraft } from '@/src/server/assistant/drafts';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  sources?: AssistantSource[];
  isAi?: boolean;
  draft?: ActionDraft;
}

const SUGGESTIONS = ['ask.suggest1', 'ask.suggest2', 'ask.suggest3', 'ask.suggest4'] as const;

/**
 * The conversation lives only in this component: nothing is stored on the server or the phone,
 * so a shared phone does not keep another worker's questions.
 */
export function AskChat() {
  const t = useT();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages.length, pending]);

  function send(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    if (text.length > ASK_MAX_QUESTION) {
      setError(t('ask.tooLong'));
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError(t('ask.offline'));
      return;
    }
    setError(null);
    setDraft('');
    const history = messages
      .slice(-ASK_MAX_HISTORY)
      .map(({ role, text: turn }) => ({ role, text: turn.slice(0, 1500) }));
    setMessages((m) => [...m, { id: nextId.current++, role: 'user', text }]);

    startTransition(async () => {
      try {
        const res = await askAction(text, history);
        if (res.ok) {
          setMessages((m) => [...m, { id: nextId.current++, role: 'assistant', ...res.answer }]);
        } else {
          setError(t(res.code === 'rate_limited' ? 'ask.tooMany' : 'ask.error'));
        }
      } catch {
        setError(t('ask.error'));
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-body">{t('ask.intro')}</p>

      <ol className="flex flex-col gap-3" aria-live="polite" aria-relevant="additions">
        {messages.map((m) => (
          <li
            key={m.id}
            className={
              m.role === 'user'
                ? 'ask-bubble ask-bubble-user self-end'
                : 'ask-bubble ask-bubble-bot self-start'
            }
          >
            <span className="sr-only">{m.role === 'user' ? t('ask.you') : t('ask.name')}: </span>
            <p className="text-body whitespace-pre-line">{m.text}</p>
            {m.role === 'assistant' ? (
              <div className="mt-2 flex flex-col gap-2">
                {m.draft ? <AskDraft draft={m.draft} /> : null}
                {m.sources && m.sources.length > 0 ? (
                  <p className="text-small flex flex-wrap items-center gap-2">
                    <span className="text-muted">{t('ask.sources')}</span>
                    {m.sources.map((s) => (
                      <Link key={s.tool} href={s.href} className="ask-chip">
                        {t(s.labelKey)}
                      </Link>
                    ))}
                  </p>
                ) : null}
                {m.draft ? null : (
                  <p className="text-small text-muted">
                    {m.isAi ? t('ask.aiNote') : t('ask.ruleNote')}
                  </p>
                )}
                <ReadAloud text={m.text} />
              </div>
            ) : null}
          </li>
        ))}
        {pending ? (
          <li className="ask-bubble ask-bubble-bot self-start" aria-busy="true">
            <p className="text-body text-muted">{t('ask.thinking')}</p>
          </li>
        ) : null}
      </ol>
      <div ref={endRef} />

      {messages.length === 0 ? (
        <section aria-labelledby="ask-suggest">
          <h2 id="ask-suggest" className="text-h2 mb-2">
            {t('ask.suggestTitle')}
          </h2>
          <ul className="flex flex-col gap-2">
            {SUGGESTIONS.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  className="choice w-full min-h-14 rounded-[10px] px-4 text-left font-semibold"
                  onClick={() => send(t(key))}
                  disabled={pending}
                >
                  {t(key)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <VoiceTextarea
          id="ask-question"
          label={t('ask.label')}
          value={draft}
          onChange={setDraft}
          placeholder={t('ask.placeholder')}
          maxLength={ASK_MAX_QUESTION}
        />
        {error ? (
          <p role="alert" className="text-body font-semibold text-escalated">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending || draft.trim().length === 0}>
          {pending ? t('ask.thinking') : t('ask.send')}
        </Button>
      </form>
    </div>
  );
}
