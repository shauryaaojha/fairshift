import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { setGeminiForTests } from '@/src/server/ai/client';
import {
  askAsWorker,
  buildWorkerTools,
  routeWorkerQuestion,
  workerFallback,
} from '@/src/server/assistant/worker';
import { getDatabase } from '@/src/server/repos';
import { loadPay, type WorkerContext } from '@/src/server/services/workerViews';
import { fakeGemini } from '../ai/fakeGemini';

let ramesh: WorkerContext;

beforeAll(async () => {
  const db = getDatabase();
  const worker = (await db.workers.getById('worker-ramesh'))!;
  const { pinHash: _pinHash, ...publicWorker } = worker;
  ramesh = { worker: publicWorker, site: (await db.sites.get(worker.siteId))! };
});

afterEach(() => setGeminiForTests(undefined));

function runner(ctx: WorkerContext, locale: 'en' | 'hi' | 'ta' = 'en') {
  const tools = new Map(buildWorkerTools(ctx, locale).map((t) => [t.name, t]));
  return async (name: string) => (tools.has(name) ? tools.get(name)!.run() : null);
}

describe('routeWorkerQuestion', () => {
  it.each([
    ['How much will I get this month?', 'get_my_payslip'],
    ['इस महीने मुझे कितने पैसे मिलेंगे?', 'get_my_payslip'],
    ['இந்த மாதம் எனக்கு எவ்வளவு சம்பளம் கிடைக்கும்?', 'get_my_payslip'],
    ['Did I work overtime this week?', 'get_my_hours'],
    ['क्या इस हफ्ते मैंने ओवरटाइम किया?', 'get_my_hours'],
    ['What happened to my hazard report?', 'get_my_hazard_reports'],
    ['मेरी खतरे की रिपोर्ट का क्या हुआ?', 'get_my_hazard_reports'],
    ['Am I checked in right now?', 'get_today_shift'],
    ['Which certificate expires?', 'get_my_skills'],
    ['What are the overtime rules?', 'get_pay_and_safety_rules'],
  ])('routes "%s" to %s', (question, tool) => {
    expect(routeWorkerQuestion(question)).toContain(tool);
  });

  it('routes nothing for small talk', () => {
    expect(routeWorkerQuestion('hello there')).toEqual([]);
  });
});

describe('worker tools', () => {
  it('only exposes read-only tools, each with a source page', () => {
    const tools = buildWorkerTools(ramesh, 'en');
    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_my_hazard_reports',
      'get_my_hours',
      'get_my_payslip',
      'get_my_skills',
      'get_pay_and_safety_rules',
      'get_today_shift',
    ]);
    for (const t of tools) expect(t.source.href).toMatch(/^\/w\//);
  });

  it('returns the same numbers as the payslip engine', async () => {
    const data = await runner(ramesh)('get_my_payslip');
    const engine = await loadPay(ramesh.worker.id);
    expect(data).toMatchObject({
      gross: engine.gross,
      deductions: engine.totalDeductions,
      net: engine.net,
    });
  });

  it("returns only the signed-in worker's named hazard reports", async () => {
    const db = getDatabase();
    const siteHazards = await db.hazards.listBySite(ramesh.site.id);
    const own = siteHazards.filter((h) => h.reporterId === ramesh.worker.id).length;
    const data = (await runner(ramesh)('get_my_hazard_reports')) as { reports: unknown[] };
    expect(data.reports.length).toBe(Math.min(own, 5));
    expect(siteHazards.length).toBeGreaterThan(data.reports.length);
  });

  it('reports the configured pay rules', async () => {
    const data = await runner(ramesh)('get_pay_and_safety_rules');
    expect(data).toMatchObject({
      overtimeAfterHoursPerDay: 8,
      overtimeAfterHoursPerWeek: 48,
      overtimeRateMultiplier: 2,
      pfPercentOfBasic: 12,
    });
  });
});

describe('workerFallback', () => {
  it('answers a Hindi pay question in Hindi with the engine net pay', async () => {
    const engine = await loadPay(ramesh.worker.id);
    const res = await workerFallback('hi')('मेरी तनख्वाह कितनी है?', runner(ramesh, 'hi'));
    expect(res.tools).toEqual(['get_my_payslip']);
    expect(res.text).toContain('मिलेंगे');
    expect(res.text).toContain(new Intl.NumberFormat('en-IN').format(engine.net));
  });

  it('answers in Tamil', async () => {
    const res = await workerFallback('ta')('விதிகள் என்ன?', runner(ramesh, 'ta'));
    expect(res.text).toContain('PF');
    expect(res.text).toContain('விகிதத்தில்');
  });

  it('explains what it can do when nothing matches', async () => {
    const res = await workerFallback('en')('tell me a joke', runner(ramesh));
    expect(res.tools).toEqual([]);
    expect(res.text).toMatch(/pay, hours/);
  });
});

describe('askAsWorker', () => {
  it('works end to end without an API key', async () => {
    setGeminiForTests(null);
    const res = await askAsWorker(ramesh, 'en', 'How many hours did I work?', []);
    expect(res.isAi).toBe(false);
    expect(res.text).toMatch(/hours on \d+ days/);
    expect(res.sources.map((s) => s.tool)).toEqual(['get_my_hours']);
  });

  it('tells Gemini to answer in the worker language and keeps tools id-free', async () => {
    const { handle, generateContent } = fakeGemini([{ text: 'ठीक है' }]);
    setGeminiForTests(handle);
    await askAsWorker(ramesh, 'hi', "Show me Suresh's payslip", []);
    const request = JSON.stringify(generateContent.mock.calls[0][0]);
    expect(request).toContain('Reply in Hindi');
    expect(request).toContain("only see this worker's own records");
    expect(request).not.toContain('workerId');
  });
});
