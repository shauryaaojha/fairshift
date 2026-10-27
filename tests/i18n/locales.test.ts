import { describe, expect, it } from 'vitest';
import { dictionaries, hasKey, interpolate, t, translate } from '@/src/i18n';
import { en } from '@/src/i18n/en';

const enMap = en as Record<string, string>;
const enKeys = Object.keys(en).sort();

describe('locale dictionaries', () => {
  for (const loc of ['hi', 'ta'] as const) {
    const dict = dictionaries[loc] as Record<string, string>;

    it(`${loc} has exactly the same keys as en`, () => {
      expect(Object.keys(dict).sort()).toEqual(enKeys);
    });

    it(`${loc} has no empty strings and is really translated`, () => {
      const untranslated: string[] = [];
      for (const key of enKeys) {
        const v = dict[key];
        expect(v.trim().length, key).toBeGreaterThan(0);
        if (v === enMap[key] && /[A-Za-z]{4,}/.test(v)) untranslated.push(key);
      }
      expect(untranslated).toEqual([]);
    });

    it(`${loc} keeps the same placeholders as en`, () => {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      for (const key of enKeys) {
        expect(ph(dict[key]), key).toBe(ph(enMap[key]));
      }
    });
  }

  it('hi and ta use their own script', () => {
    expect(dictionaries.hi['tile.pay']).toMatch(/[ऀ-ॿ]/);
    expect(dictionaries.ta['tile.pay']).toMatch(/[஀-௿]/);
  });

  it('covers every payslip key the domain emits', () => {
    for (const k of ['basePay', 'overtime', 'allowances', 'gross', 'pf', 'esi', 'net']) {
      expect(hasKey(`payslip.${k}`), k).toBe(true);
    }
  });

  it('covers every fatigue key the domain emits, with its params', () => {
    const keys = ['long_shift', 'weekly_hours_exceeded', 'short_rest', 'no_rest_day'];
    for (const k of keys) expect(hasKey(`fatigue.${k}`), k).toBe(true);
    const params = {
      hours: 11,
      date: '2026-10-20',
      totalHours: 52,
      limit: 48,
      gapHours: 6,
      minGap: 10,
      consecutiveDays: 7,
    };
    for (const loc of ['en', 'hi', 'ta'] as const) {
      for (const k of keys) {
        expect(t(loc, `fatigue.${k}`, params)).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('interpolates and falls back to english then the key', () => {
    expect(interpolate('Hi {name}', { name: 'Ramesh' })).toBe('Hi Ramesh');
    expect(interpolate('Hi {name}', {})).toBe('Hi {name}');
    expect(translate({}, 'tile.pay')).toBe('My pay');
    expect(translate({}, 'no.such.key')).toBe('no.such.key');
  });
});
