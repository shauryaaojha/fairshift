/**
 * Gemini client (Google Gen AI SDK, Gemini Developer API).
 *
 * One place for the key, the model id, the timeout and the "AI is optional" rule: every caller
 * gets `null` back when Gemini is not configured, fails or is slow, and then uses its
 * deterministic fallback. The key is a server-only environment variable and never reaches the
 * browser.
 */

import {
  GoogleGenAI,
  type GenerateContentConfig,
  type GenerateContentParameters,
} from '@google/genai';
import { serverEnv } from '../env';

export const AI_TIMEOUT_MS = 12_000;

/** Short, grounded answers need no extended reasoning; skipping it roughly halves latency. */
const FAST: GenerateContentConfig = { thinkingConfig: { thinkingBudget: 0 } };

export interface GeminiHandle {
  /** The subset of the SDK we call; narrowed so tests can pass a fake. */
  models: { generateContent: GoogleGenAI['models']['generateContent'] };
  model: string;
}

let override: GeminiHandle | null | undefined;
let cached: { key: string; handle: GeminiHandle } | null = null;

/**
 * Circuit breaker. After a 429 (quota or rate limit) every AI call would fail the same way until
 * the window resets, so callers skip straight to their fallback instead of spending a round trip
 * and a log line on each request. The free tier allows only a few requests a minute.
 */
let pausedUntil = 0;
const DEFAULT_PAUSE_MS = 60_000;

const rawMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function isRateLimited(err: unknown): boolean {
  return /\b429\b|RESOURCE_EXHAUSTED/.test(rawMessage(err));
}

/** Pause AI for the delay the API asked for ("retry in 23.4s"), or a minute. */
export function pauseAfterRateLimit(err: unknown, now: number = Date.now()): void {
  const seconds = Number(/retry in ([\d.]+)s/i.exec(rawMessage(err))?.[1]);
  pausedUntil = now + (Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_PAUSE_MS);
}

export function aiPaused(now: number = Date.now()): boolean {
  return now < pausedUntil;
}

export function getGemini(): GeminiHandle | null {
  if (aiPaused()) return null;
  if (override !== undefined) return override;
  const { geminiApiKey, geminiModel } = serverEnv();
  if (!geminiApiKey) return null;
  if (cached?.key !== geminiApiKey) {
    const client = new GoogleGenAI({ apiKey: geminiApiKey });
    cached = { key: geminiApiKey, handle: { models: client.models, model: geminiModel } };
  }
  return cached.handle;
}

/** Tests inject a fake client (or `null` for "not configured"); `undefined` restores the real one. */
export function setGeminiForTests(handle: GeminiHandle | null | undefined): void {
  override = handle;
  pausedUntil = 0;
}

export async function withTimeout<T>(promise: Promise<T>, ms: number = AI_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`AI request timed out after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

type Request = Omit<GenerateContentParameters, 'model'>;

/** One generateContent call with the fast config and the timeout. Throws on failure. */
export async function generate(gemini: GeminiHandle, request: Request) {
  try {
    return await withTimeout(
      gemini.models.generateContent({
        ...request,
        model: gemini.model,
        config: { ...FAST, ...request.config },
      }),
    );
  } catch (err) {
    if (isRateLimited(err)) pauseAfterRateLimit(err);
    throw err;
  }
}

/** Plain-text completion, or `null` when AI is unavailable, fails or returns nothing. */
export async function generateText(scope: string, prompt: string): Promise<string | null> {
  const gemini = getGemini();
  if (!gemini) return null;
  try {
    const response = await generate(gemini, { contents: prompt });
    return response.text?.trim() || null;
  } catch (err) {
    console.warn(`[FairShift AI] ${scope} failed, using the fallback:`, describeError(err));
    return null;
  }
}

/** Structured completion validated by the caller's parser, or `null` on any failure. */
export async function generateJson<T>(
  scope: string,
  prompt: string,
  jsonSchema: Record<string, unknown>,
  parse: (value: unknown) => T | null,
): Promise<T | null> {
  const gemini = getGemini();
  if (!gemini) return null;
  try {
    const response = await generate(gemini, {
      contents: prompt,
      config: { responseMimeType: 'application/json', responseJsonSchema: jsonSchema },
    });
    return response.text ? parse(JSON.parse(response.text)) : null;
  } catch (err) {
    console.warn(`[FairShift AI] ${scope} failed, using the fallback:`, describeError(err));
    return null;
  }
}

/**
 * A short, log-safe description. SDK errors can carry the whole request (which includes user
 * text) and long JSON bodies, so only the first part of the message is kept.
 */
export function describeError(err: unknown): string {
  const message = rawMessage(err);
  if (isRateLimited(err)) {
    return 'rate limited by the Gemini API (429); AI paused until the window resets';
  }
  return message.length > 240 ? `${message.slice(0, 240)}…` : message;
}
