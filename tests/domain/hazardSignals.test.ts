import { describe, expect, it } from 'vitest';
import {
  coarsenToHour,
  severityFloor,
  suggestSeverityFromText,
} from '@/src/server/domain/hazardSignals';

describe('danger words', () => {
  it('reads danger in English, Hindi and Tamil', () => {
    expect(suggestSeverityFromText('Live wire hanging near the lift')).toBe('critical');
    expect(suggestSeverityFromText('सीढ़ी के पास बिजली का तार खुला है')).toBe('critical');
    expect(suggestSeverityFromText('மின் கம்பி திறந்து கிடக்கிறது')).toBe('critical');
    expect(suggestSeverityFromText('Crack in the slab on floor 3')).toBe('high');
    expect(suggestSeverityFromText('Water cooler is empty')).toBeNull();
  });

  it('only ever raises the worker’s rating', () => {
    expect(severityFloor('low', 'live wire in the trench')).toBe('critical');
    expect(severityFloor('low', 'loose scaffold on B block')).toBe('high');
    expect(severityFloor('critical', 'crack in the wall')).toBe('critical');
    expect(severityFloor('medium', 'Toilets not cleaned')).toBe('medium');
  });
});

describe('anonymous report time', () => {
  it('drops the minutes in India time (an IST hour starts at :30 UTC)', () => {
    // 14:07 IST -> 14:00 IST
    expect(coarsenToHour('2026-10-31T08:37:12.345Z')).toBe('2026-10-31T08:30:00.000Z');
    // 14:00 IST exactly stays put
    expect(coarsenToHour('2026-10-31T08:30:00.000Z')).toBe('2026-10-31T08:30:00.000Z');
    // 00:10 IST rounds to midnight IST, which is the previous day in UTC
    expect(coarsenToHour('2026-10-30T18:40:00.000Z')).toBe('2026-10-30T18:30:00.000Z');
  });

  it('never moves the time later', () => {
    for (const iso of ['2026-01-01T00:00:00.000Z', '2026-06-15T23:59:59.999Z']) {
      const out = Date.parse(coarsenToHour(iso));
      expect(out).toBeLessThanOrEqual(Date.parse(iso));
      expect(Date.parse(iso) - out).toBeLessThan(3600_000);
    }
  });
});
