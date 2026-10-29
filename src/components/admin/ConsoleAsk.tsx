'use client';

import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { askConsoleAction } from '@/app/admin/actions';
import { ASK_MAX_HISTORY, ASK_MAX_QUESTION } from '@/src/shared/limits';
import type { AssistantSource } from '@/src/server/assistant/engine';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  sources?: AssistantSource[];
  isAi?: boolean;
}

const SUGGESTIONS = [
  'What needs my attention today?',
  'Which hazards are overdue?',
  'Who is most likely to quit, and why?',
  'How is team morale this week?',
];

/** Supervisor Q&A over the console's own data. The thread is kept in memory only. */
export function ConsoleAsk({ place }: { place: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nextId = useRef(1);

  function send(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    setError(null);
    setDraft('');
    const history = messages.slice(-ASK_MAX_HISTORY).map(({ role, text: turn }) => ({
      role,
      text: turn.slice(0, 1500),
    }));
    setMessages((m) => [...m, { id: nextId.current++, role: 'user', text }]);
    startTransition(async () => {
      try {
        const res = await askConsoleAction(text, history);
        if (res.ok) {
          setMessages((m) => [...m, { id: nextId.current++, role: 'assistant', ...res.answer }]);
        } else {
          setError(res.reason);
        }
      } catch {
        setError('Could not answer right now. Try again.');
      }
    });
  }

  return (
    <div className="console-ask">
      <ol className="console-thread" aria-live="polite" aria-relevant="additions">
        {messages.map((m) => (
          <li key={m.id} className={`panel console-msg console-msg-${m.role}`}>
            <p className="text-small muted">{m.role === 'user' ? 'You asked' : 'Console'}</p>
            <p className="console-text">{m.text}</p>
            {m.role === 'assistant' ? (
              <p className="text-small muted console-meta">
                {m.sources && m.sources.length > 0 ? (
                  <>
                    From{' '}
                    {m.sources.map((s, i) => (
                      <span key={s.tool}>
                        {i > 0 ? ', ' : ''}
                        <Link href={s.href} className="link">
                          {s.labelKey}
                        </Link>
                      </span>
                    ))}
                    {' · '}
                  </>
                ) : null}
                {m.isAi ? 'Written by AI from live console data' : 'Rule-based answer'}
              </p>
            ) : null}
          </li>
        ))}
        {pending ? (
          <li className="panel console-msg" aria-busy="true">
            <p className="muted">Reading the console…</p>
          </li>
        ) : null}
      </ol>

      {messages.length === 0 ? (
        <ul className="console-suggest" aria-label="Suggested questions">
          {SUGGESTIONS.map((q) => (
            <li key={q}>
              <button
                type="button"
                className="btn-quiet"
                onClick={() => send(q)}
                disabled={pending}
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="console-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <div className="field console-field">
          <label htmlFor="console-question">Ask about {place}</label>
          <input
            id="console-question"
            value={draft}
            maxLength={ASK_MAX_QUESTION}
            autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Which team is overworked?"
          />
        </div>
        <button type="submit" className="btn-primary" disabled={pending || !draft.trim()}>
          {pending ? 'Asking…' : 'Ask'}
        </button>
      </form>
      {error ? (
        <p role="alert" className="console-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
