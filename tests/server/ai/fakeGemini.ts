import { vi } from 'vitest';
import type { GeminiHandle } from '@/src/server/ai/client';

export interface FakeReply {
  text?: string;
  functionCalls?: Array<{ name: string; id?: string; args?: Record<string, unknown> }>;
}

/**
 * A scripted Gemini: each generateContent call returns the next reply (or throws it, if it is an
 * Error). The mock records every request so tests can check what was sent.
 */
export function fakeGemini(replies: Array<FakeReply | Error>) {
  const queue = [...replies];
  const generateContent = vi.fn(async (_request: unknown) => {
    const next = queue.shift();
    if (!next) throw new Error('fake Gemini: no scripted reply left');
    if (next instanceof Error) throw next;
    return {
      text: next.text,
      functionCalls: next.functionCalls,
      candidates: [
        {
          content: {
            role: 'model',
            parts: next.functionCalls?.map((fc) => ({ functionCall: fc })) ?? [{ text: next.text }],
          },
        },
      ],
    };
  });
  const handle = { model: 'fake-model', models: { generateContent } } as unknown as GeminiHandle;
  return { handle, generateContent };
}
