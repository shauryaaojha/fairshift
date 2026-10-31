import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { draftFromMessage } from '@/src/server/assistant/drafts';
import { askAsWorker, describeDraft } from '@/src/server/assistant/worker';
import { setGeminiForTests } from '@/src/server/ai/client';
import { getDatabase } from '@/src/server/repos';
import type { WorkerContext } from '@/src/server/services/workerViews';
import { fakeGemini } from '../ai/fakeGemini';

afterEach(() => setGeminiForTests(undefined));

describe('draftFromMessage: hazards', () => {
  it.each([
    ['The railing on the 9th floor is broken', 'fall', 'medium'],
    ['Live wire hanging near the lift shaft', 'electric', 'critical'],
    ['सीढ़ी के पास बिजली का तार खुला है', 'electric', 'critical'],
    ['मचान हिल रहा है, कोई गिर सकता है', 'fall', 'critical'],
    ['Gas smell near the canteen kitchen', 'fire', 'critical'],
    ['கிரேன் அருகே இயந்திர காவல் இல்லை', 'equipment', 'medium'],
    ['மின் கம்பி திறந்து கிடக்கிறது', 'electric', 'critical'],
    ['Crack in the slab on floor 3', 'fall', 'high'],
  ])('"%s" -> %s, %s', (message, category, severity) => {
    expect(draftFromMessage(message)).toMatchObject({
      kind: 'hazard',
      category,
      severity,
      description: message,
    });
  });

  it('gives the deadline the report will get', () => {
    const d = draftFromMessage('Live wire hanging near the lift shaft');
    expect(d).toMatchObject({ kind: 'hazard', deadlineHours: 1 });
  });

  it('a hazard wins over a complaint about the supervisor', () => {
    expect(draftFromMessage('The supervisor ignores the broken ladder')).toMatchObject({
      kind: 'hazard',
      category: 'fall',
    });
  });
});

describe('draftFromMessage: feedback', () => {
  it.each([
    'The supervisor shouts when we ask about leave',
    'ठेकेदार गाली देता है',
    'மேற்பார்வையாளர் எங்களை திட்டுகிறார்',
  ])('"%s" becomes anonymous feedback', (message) => {
    expect(draftFromMessage(message)).toEqual({ kind: 'feedback', comment: message });
  });
});

describe('draftFromMessage: questions stay questions', () => {
  it.each([
    'What happened to my hazard report?',
    'मेरी खतरे की रिपोर्ट का क्या हुआ?',
    'What are the fire safety rules?',
    'How much will I get this month?',
    'I was shocked by my pay this month',
    'Did I work overtime this week?',
    'hi',
    '',
  ])('"%s" -> null', (message) => {
    expect(draftFromMessage(message)).toBeNull();
  });
});

describe('Urima with a draft', () => {
  it('describes the draft in the worker’s language', () => {
    const d = draftFromMessage('सीढ़ी के पास बिजली का तार खुला है')!;
    expect(describeDraft(d, 'hi')).toContain('बिजली');
    expect(describeDraft(d, 'en')).toContain('Electric');
    expect(describeDraft({ kind: 'feedback', comment: 'x' }, 'ta')).toContain('பெயர்');
  });

  it('returns the draft without calling the model, and files nothing', async () => {
    const gemini = fakeGemini([]);
    setGeminiForTests(gemini.handle);
    const db = getDatabase();
    const w = (await db.workers.getById('worker-ramesh'))!;
    const { pinHash: _pinHash, ...worker } = w;
    const ctx: WorkerContext = { worker, site: (await db.sites.get(w.siteId))! };
    const before = (await db.hazards.listBySite(w.siteId)).length;

    const answer = await askAsWorker(ctx, 'en', 'Live wire hanging near the lift shaft', []);

    expect(answer.draft).toMatchObject({ kind: 'hazard', category: 'electric' });
    expect(answer.isAi).toBe(false);
    expect(gemini.generateContent).not.toHaveBeenCalled();
    expect((await db.hazards.listBySite(w.siteId)).length).toBe(before);
  });
});
