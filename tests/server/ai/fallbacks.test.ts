import { describe, expect, it } from 'vitest';
import {
  explainPayslipFallback,
  generateWeeklySafetySummaryFallback,
} from '@/src/server/ai/fallbacks';
import type { PayslipResult } from '@/src/shared/types';

const slip = (lines: PayslipResult['lines'], net: number): PayslipResult => ({
  lines,
  gross: net,
  totalDeductions: 0,
  net,
  periodStart: '2026-10-01',
  periodEnd: '2026-10-27',
});

const full = slip(
  [
    { key: 'payslip.basePay', label: 'Base', amount: 18000, type: 'earning' },
    { key: 'payslip.overtime', label: 'OT', amount: 1500, type: 'earning' },
    { key: 'payslip.allowances', label: 'Allowances', amount: 600, type: 'earning' },
    { key: 'payslip.pf', label: 'PF', amount: 1800, type: 'deduction' },
    { key: 'payslip.esi', label: 'ESI', amount: 151, type: 'deduction' },
  ],
  18149,
);
const plain = slip(
  [{ key: 'payslip.basePay', label: 'Base', amount: 9000, type: 'earning' }],
  9000,
);

describe('explainPayslipFallback', () => {
  it.each(['en', 'hi', 'ta'] as const)('mentions every non-zero line in %s', (locale) => {
    const text = explainPayslipFallback(full, locale);
    for (const n of ['18,149', '18,000', '1,500', '600', '1800', '151']) expect(text).toContain(n);
  });

  it.each(['en', 'hi', 'ta'] as const)('leaves out zero lines in %s', (locale) => {
    const text = explainPayslipFallback(plain, locale);
    expect(text).toContain('9,000');
    expect(text).not.toContain('PF');
  });

  it('uses each language script', () => {
    expect(explainPayslipFallback(full, 'hi')).toMatch(/[ऀ-ॿ]/);
    expect(explainPayslipFallback(full, 'ta')).toMatch(/[஀-௿]/);
  });
});

describe('generateWeeklySafetySummaryFallback', () => {
  const base = {
    onSiteNow: 10,
    totalWorkers: 20,
    escalatedHazards: 0,
    openHazards: 0,
    fatigueFlags: 0,
    highQuitRisk: 0,
  };

  it('leads with escalations when there are any', () => {
    expect(generateWeeklySafetySummaryFallback({ ...base, escalatedHazards: 2 })).toContain(
      'Attention required: 2 hazard',
    );
  });

  it('reports open hazards within deadline, or an all-clear', () => {
    expect(generateWeeklySafetySummaryFallback({ ...base, openHazards: 3 })).toContain(
      '3 open hazard',
    );
    expect(generateWeeklySafetySummaryFallback(base)).toContain('acknowledged or resolved');
  });

  it('adds fatigue and quit-risk when flagged', () => {
    const text = generateWeeklySafetySummaryFallback({ ...base, fatigueFlags: 4, highQuitRisk: 1 });
    expect(text).toContain('4 worker(s)');
    expect(generateWeeklySafetySummaryFallback(base)).toContain('within standard');
  });
});
