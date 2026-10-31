/**
 * Urima, FairShift's assistant: a grounded question-answering loop. The name comes from the
 * Tamil உரிமை (a right, what one is owed) and reads the same in English, Hindi and Tamil.
 *
 * The model can only call the read-only tools it is handed. Every tool is already bound on the
 * server to the signed-in user (the worker's id, or the admin's permitted sector), and none takes
 * an id argument, so a question like "show me Ravi's payslip" or an injected instruction cannot
 * widen what is read. Numbers in an answer come from tool results, which come from the tested
 * rule engines. When Gemini is not configured, fails, or loops, a deterministic router answers
 * from the same tools, so the feature works with no API key at all.
 */

import type { Content, FunctionCall, Part } from '@google/genai';
import { describeError, generate, getGemini } from '../ai/client';
import type { ActionDraft } from './drafts';

export interface AssistantTool {
  name: string;
  /** Shown to the model so it can pick the right tool. */
  description: string;
  /** Link chip under the answer that says where the numbers came from. */
  source: { labelKey: string; href: string };
  run: () => Promise<Record<string, unknown>>;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantSource {
  tool: string;
  labelKey: string;
  href: string;
}

export interface AssistantAnswer {
  text: string;
  sources: AssistantSource[];
  isAi: boolean;
  /** A report or feedback Urima filled in from the message, for the worker to check and send. */
  draft?: ActionDraft;
}

/** Deterministic answerer: picks tools for the question and writes a templated reply. */
export type FallbackAnswerer = (
  question: string,
  run: (name: string) => Promise<Record<string, unknown> | null>,
) => Promise<{ text: string; tools: string[] }>;

export interface AskParams {
  question: string;
  history: ChatTurn[];
  tools: AssistantTool[];
  systemInstruction: string;
  fallback: FallbackAnswerer;
}

/**
 * The chat renders plain text (and is read aloud), so markdown the model adds anyway would show
 * as stray symbols: bold markers are dropped, list bullets become "•", heading hashes go.
 */
export function toPlainText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^[ \t]*[*-][ \t]+/gm, '• ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Tool rounds before the model must answer. Two are enough for any question the tools cover. */
export const MAX_TOOL_ROUNDS = 3;

/** Runs each tool at most once per question and remembers which ones were used. */
function toolRunner(tools: AssistantTool[]) {
  const byName = new Map(tools.map((t) => [t.name, t]));
  const results = new Map<string, Promise<Record<string, unknown>>>();
  return {
    has: (name: string) => byName.has(name),
    run(name: string): Promise<Record<string, unknown>> | null {
      const tool = byName.get(name);
      if (!tool) return null;
      if (!results.has(name)) results.set(name, tool.run());
      return results.get(name)!;
    },
    sources(): AssistantSource[] {
      return [...results.keys()].map((name) => {
        const { source } = byName.get(name)!;
        return { tool: name, labelKey: source.labelKey, href: source.href };
      });
    },
  };
}

function toContents(history: ChatTurn[], question: string): Content[] {
  return [
    ...history.map((turn) => ({
      role: turn.role === 'user' ? 'user' : 'model',
      parts: [{ text: turn.text }],
    })),
    { role: 'user', parts: [{ text: question }] },
  ];
}

async function answerWithGemini(params: AskParams): Promise<AssistantAnswer | null> {
  const gemini = getGemini();
  if (!gemini) return null;

  const runner = toolRunner(params.tools);
  const contents = toContents(params.history, params.question);
  const config = {
    systemInstruction: params.systemInstruction,
    tools: [
      {
        functionDeclarations: params.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parametersJsonSchema: { type: 'object', properties: {} },
        })),
      },
    ],
  };

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await generate(gemini, { contents, config });
      const calls: FunctionCall[] = response.functionCalls ?? [];
      if (calls.length === 0) {
        const text = toPlainText(response.text ?? '');
        return text ? { text, sources: runner.sources(), isAi: true } : null;
      }
      if (round === MAX_TOOL_ROUNDS) break;

      const modelParts = response.candidates?.[0]?.content?.parts ?? [];
      contents.push({ role: 'model', parts: modelParts });
      const responseParts: Part[] = await Promise.all(
        calls.map(async (call) => {
          const name = call.name ?? '';
          const result = runner.run(name);
          return {
            functionResponse: {
              id: call.id,
              name,
              response: result ? { result: await result } : { error: `Unknown tool ${name}` },
            },
          };
        }),
      );
      contents.push({ role: 'user', parts: responseParts });
    }
    console.warn('[FairShift AI] assistant hit the tool-round limit, using the fallback');
  } catch (err) {
    console.warn('[FairShift AI] assistant failed, using the fallback:', describeError(err));
  }
  return null;
}

export async function ask(params: AskParams): Promise<AssistantAnswer> {
  const ai = await answerWithGemini(params);
  if (ai) return ai;

  const runner = toolRunner(params.tools);
  const { text } = await params.fallback(params.question, async (name) => {
    const result = runner.run(name);
    return result ? await result : null;
  });
  return { text, sources: runner.sources(), isAi: false };
}
