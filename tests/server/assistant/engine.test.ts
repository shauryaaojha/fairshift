import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setGeminiForTests } from '@/src/server/ai/client';
import {
  MAX_TOOL_ROUNDS,
  ask,
  toPlainText,
  type AssistantTool,
} from '@/src/server/assistant/engine';
import { fakeGemini } from '../ai/fakeGemini';

function tool(
  name: string,
  data: Record<string, unknown>,
): AssistantTool & { run: ReturnType<typeof vi.fn> } {
  return {
    name,
    description: `${name} tool`,
    source: { labelKey: `src.${name}`, href: `/${name}` },
    run: vi.fn(async () => data),
  };
}

const fallback = vi.fn(async (_q: string, run: (name: string) => Promise<unknown>) => {
  await run('pay');
  return { text: 'Fallback answer', tools: ['pay'] };
});

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  fallback.mockClear();
});

afterEach(() => {
  setGeminiForTests(undefined);
  vi.restoreAllMocks();
});

const base = { question: 'How much is my pay?', history: [], systemInstruction: 'sys', fallback };

describe('ask with Gemini', () => {
  it('runs the requested tool, feeds the result back and returns the answer with its source', async () => {
    const pay = tool('pay', { net: 14400 });
    const { handle, generateContent } = fakeGemini([
      { functionCalls: [{ name: 'pay', id: 'c1' }] },
      { text: 'You take home ₹14,400.' },
    ]);
    setGeminiForTests(handle);

    const res = await ask({ ...base, tools: [pay] });

    expect(res).toEqual({
      text: 'You take home ₹14,400.',
      sources: [{ tool: 'pay', labelKey: 'src.pay', href: '/pay' }],
      isAi: true,
    });
    expect(pay.run).toHaveBeenCalledOnce();
    const second = JSON.stringify(generateContent.mock.calls[1]);
    expect(second).toContain('14400');
    expect(second).toContain('"id":"c1"');
  });

  it('declares tools with no parameters, so the model cannot pass an id', async () => {
    const { handle, generateContent } = fakeGemini([{ text: 'Hi' }]);
    setGeminiForTests(handle);
    await ask({ ...base, tools: [tool('pay', {})] });
    const request = generateContent.mock.calls[0][0] as unknown as {
      config: { tools: Array<{ functionDeclarations: Array<{ parametersJsonSchema: unknown }> }> };
    };
    expect(request.config.tools[0].functionDeclarations[0].parametersJsonSchema).toEqual({
      type: 'object',
      properties: {},
    });
  });

  it('runs a tool once even if the model asks for it twice', async () => {
    const pay = tool('pay', { net: 1 });
    setGeminiForTests(
      fakeGemini([
        { functionCalls: [{ name: 'pay' }, { name: 'pay' }] },
        { functionCalls: [{ name: 'pay' }] },
        { text: 'Done' },
      ]).handle,
    );
    const res = await ask({ ...base, tools: [pay] });
    expect(res.text).toBe('Done');
    expect(pay.run).toHaveBeenCalledOnce();
    expect(res.sources).toHaveLength(1);
  });

  it('answers an unknown tool call with an error instead of running anything', async () => {
    const pay = tool('pay', {});
    const { handle, generateContent } = fakeGemini([
      { functionCalls: [{ name: 'read_all_workers' }] },
      { text: 'I can only see your records.' },
    ]);
    setGeminiForTests(handle);
    const res = await ask({ ...base, tools: [pay] });
    expect(res.sources).toEqual([]);
    expect(JSON.stringify(generateContent.mock.calls[1])).toContain(
      'Unknown tool read_all_workers',
    );
  });

  it('falls back after too many tool rounds', async () => {
    const loops = Array.from({ length: MAX_TOOL_ROUNDS + 1 }, () => ({
      functionCalls: [{ name: 'pay' }],
    }));
    setGeminiForTests(fakeGemini(loops).handle);
    const res = await ask({ ...base, tools: [tool('pay', {})] });
    expect(res).toMatchObject({ text: 'Fallback answer', isAi: false });
  });

  it('falls back when Gemini throws', async () => {
    setGeminiForTests(fakeGemini([new Error('quota exceeded')]).handle);
    const res = await ask({ ...base, tools: [tool('pay', {})] });
    expect(res.isAi).toBe(false);
    expect(fallback).toHaveBeenCalledOnce();
  });

  it('sends the earlier turns as user and model content', async () => {
    const { handle, generateContent } = fakeGemini([{ text: 'ok' }]);
    setGeminiForTests(handle);
    await ask({
      ...base,
      history: [
        { role: 'user', text: 'first' },
        { role: 'assistant', text: 'answer' },
      ],
      tools: [],
    });
    const request = generateContent.mock.calls[0][0] as unknown as {
      contents: Array<{ role: string }>;
    };
    expect(request.contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);
  });
});

describe('ask without Gemini', () => {
  it('uses the fallback and still reports the tools it used', async () => {
    setGeminiForTests(null);
    const res = await ask({ ...base, tools: [tool('pay', { net: 1 })] });
    expect(res).toEqual({
      text: 'Fallback answer',
      sources: [{ tool: 'pay', labelKey: 'src.pay', href: '/pay' }],
      isAi: false,
    });
  });
});

describe('toPlainText', () => {
  it('turns the markdown Gemini sometimes adds into plain, speakable text', () => {
    // The shape of a real console answer from gemini-3.6-flash.
    const md =
      'Here is what needs your attention:\n\n\n* **1 Escalated Critical Hazard:** exposed 440V line.\n- **Worker Welfare:** 6 fatigue flags.\n## Next\nUse `Safety queue`.';
    expect(toPlainText(md)).toBe(
      'Here is what needs your attention:\n\n• 1 Escalated Critical Hazard: exposed 440V line.\n• Worker Welfare: 6 fatigue flags.\nNext\nUse Safety queue.',
    );
  });

  it('leaves plain text and rupee amounts alone', () => {
    expect(toPlainText('  आपको ₹8,755 मिलेंगे। 2*3 = 6  ')).toBe('आपको ₹8,755 मिलेंगे। 2*3 = 6');
  });
});
