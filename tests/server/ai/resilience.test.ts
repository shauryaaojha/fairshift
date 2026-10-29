import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aiPaused,
  describeError,
  getGemini,
  isRateLimited,
  pauseAfterRateLimit,
  setGeminiForTests,
} from '@/src/server/ai/client';
import {
  BRIEFING_TTL_MS,
  clearBriefingCacheForTests,
  generateWeeklySafetySummary,
} from '@/src/server/ai/gemini';
import { fakeGemini } from './fakeGemini';

/** The shape of the Gemini API error seen in production on the free tier. */
const QUOTA_ERROR = new Error(
  '{"error":{"code":429,"message":"You exceeded your current quota ... Please retry in 23.49s.","status":"RESOURCE_EXHAUSTED"}}',
);

const stats = {
  onSiteNow: 18,
  totalWorkers: 30,
  escalatedHazards: 1,
  openHazards: 2,
  fatigueFlags: 6,
  highQuitRisk: 2,
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  clearBriefingCacheForTests();
});

afterEach(() => {
  setGeminiForTests(undefined);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('rate-limit circuit breaker', () => {
  it('recognises a 429 and reads the retry delay the API asks for', () => {
    expect(isRateLimited(QUOTA_ERROR)).toBe(true);
    expect(isRateLimited(new Error('fetch failed'))).toBe(false);
    pauseAfterRateLimit(QUOTA_ERROR, 1_000_000);
    expect(aiPaused(1_000_000 + 23_000)).toBe(true);
    expect(aiPaused(1_000_000 + 24_000)).toBe(false);
  });

  it('pauses a minute when no delay is given', () => {
    pauseAfterRateLimit(new Error('429 Too Many Requests'), 0);
    expect(aiPaused(59_000)).toBe(true);
    expect(aiPaused(61_000)).toBe(false);
  });

  it('skips Gemini after a 429 until the window passes, so no request is wasted', async () => {
    vi.useFakeTimers();
    const { handle, generateContent } = fakeGemini([QUOTA_ERROR, { text: 'Briefing.' }]);
    setGeminiForTests(handle);

    expect((await generateWeeklySafetySummary(stats)).isAi).toBe(false);
    expect(getGemini()).toBeNull();
    expect((await generateWeeklySafetySummary({ ...stats, onSiteNow: 19 })).isAi).toBe(false);
    expect(generateContent).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(24_000);
    expect((await generateWeeklySafetySummary(stats)).isAi).toBe(true);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('logs a short line instead of the whole API error body', () => {
    expect(describeError(QUOTA_ERROR)).toMatch(/^rate limited by the Gemini API \(429\)/);
    expect(describeError(new Error('x'.repeat(500)))).toHaveLength(241);
  });
});

describe('briefing cache', () => {
  it('reuses a briefing while the numbers are unchanged, and refreshes when they change', async () => {
    const { handle, generateContent } = fakeGemini([{ text: 'First.' }, { text: 'Second.' }]);
    setGeminiForTests(handle);

    expect((await generateWeeklySafetySummary(stats)).summary).toBe('First.');
    expect((await generateWeeklySafetySummary(stats)).summary).toBe('First.');
    expect(generateContent).toHaveBeenCalledTimes(1);

    expect((await generateWeeklySafetySummary({ ...stats, escalatedHazards: 2 })).summary).toBe(
      'Second.',
    );
  });

  it('expires a briefing after its time to live', async () => {
    vi.useFakeTimers();
    const { handle, generateContent } = fakeGemini([{ text: 'Old.' }, { text: 'New.' }]);
    setGeminiForTests(handle);
    await generateWeeklySafetySummary(stats);
    vi.advanceTimersByTime(BRIEFING_TTL_MS + 1);
    expect((await generateWeeklySafetySummary(stats)).summary).toBe('New.');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});
