import { describe, expect, it } from 'vitest';
import { COMPLAINT_STEPS, HELPLINES, RIGHTS, formatHelpline } from '@/src/shared/rights';
import { dictionaries, hasKey } from '@/src/i18n';

describe('rights data', () => {
  it('cites a law for every right and has unique ids', () => {
    expect(new Set(RIGHTS.map((r) => r.id)).size).toBe(RIGHTS.length);
    for (const r of RIGHTS) {
      expect(r.source, r.id).toMatch(/Code/);
      expect(r.fact.length, r.id).toBeGreaterThan(20);
    }
  });

  it('has a title and body for every right and a label for every helpline, in all languages', () => {
    for (const loc of ['en', 'hi', 'ta'] as const) {
      const dict = dictionaries[loc] as Record<string, string>;
      for (const r of RIGHTS) {
        expect(dict[`rights.${r.id}.title`], `${loc} ${r.id}`).toBeTruthy();
        expect(dict[`rights.${r.id}.body`], `${loc} ${r.id}`).toBeTruthy();
      }
      for (const h of HELPLINES) expect(dict[`rights.help.${h.id}`], `${loc} ${h.id}`).toBeTruthy();
    }
    expect(hasKey('rights.title')).toBe(true);
  });

  it('dials digits only and shows toll-free numbers grouped', () => {
    for (const h of HELPLINES) expect(h.number).toMatch(/^\d{3,10}$/);
    expect(formatHelpline('1800112526')).toBe('1800-11-2526');
    expect(formatHelpline('14470')).toBe('14470');
  });

  it('lists where to complain, in order, in every language', () => {
    expect(COMPLAINT_STEPS.map((c) => c.id)).toEqual([
      'employer',
      'samadhan',
      'labourOffice',
      'legalAid',
    ]);
    expect(COMPLAINT_STEPS[0].href).toBe('/w/pay/query');
    expect(COMPLAINT_STEPS.find((c) => c.id === 'samadhan')?.href).toMatch(/^https:\/\//);
    expect(HELPLINES.some((h) => h.number === '15100')).toBe(true);
    for (const loc of ['en', 'hi', 'ta'] as const) {
      const dict = dictionaries[loc] as Record<string, string>;
      for (const c of COMPLAINT_STEPS) {
        expect(dict[`rights.complain.${c.id}.title`], `${loc} ${c.id}`).toBeTruthy();
        expect(dict[`rights.complain.${c.id}.body`], `${loc} ${c.id}`).toBeTruthy();
        if (c.href) expect(dict[`rights.complain.${c.id}.go`], `${loc} ${c.id}`).toBeTruthy();
      }
    }
  });
});
