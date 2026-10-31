import { describe, expect, it } from 'vitest';
import { assessHeat, heatIndexC, heatLevel, heatNeedsAction } from '@/src/server/domain/heat';

describe('heatIndexC', () => {
  it('matches the NWS heat index table', () => {
    // NWS table: 90 °F at 70% RH reads 106 °F (41.1 °C); 96 °F at 50% reads 108 °F (42.2 °C).
    expect(heatIndexC(32.2, 70)).toBeCloseTo(41.1, 0);
    expect(heatIndexC(35.6, 50)).toBeCloseTo(42.2, 0);
    // 80 °F at 40% reads 80 °F.
    expect(heatIndexC(26.7, 40)).toBeCloseTo(26.7, 0);
  });

  it('uses the simple formula when it is mild', () => {
    // 68 °F at 50%: 0.5 × (68 + 61 + 0 + 4.7) = 66.85 °F.
    expect(heatIndexC(20, 50)).toBeCloseTo(19.4, 1);
  });

  it('applies the dry-air and very-humid adjustments', () => {
    // Dry air lowers the index below the plain regression.
    expect(heatIndexC(40, 10)).toBeLessThan(40);
    // Very humid air near 85 °F raises it.
    expect(heatIndexC(29, 95)).toBeGreaterThan(heatIndexC(29, 85));
  });

  it('clamps humidity to 0-100', () => {
    expect(heatIndexC(35, 140)).toBe(heatIndexC(35, 100));
  });
});

describe('heatLevel', () => {
  it('uses the NWS bands', () => {
    expect(heatLevel(26.6)).toBe('none');
    expect(heatLevel(26.7)).toBe('caution');
    expect(heatLevel(32.2)).toBe('extreme_caution');
    expect(heatLevel(39.4)).toBe('danger');
    expect(heatLevel(51.7)).toBe('extreme_danger');
  });

  it('asks the site to act from Danger up', () => {
    expect(heatNeedsAction('extreme_caution')).toBe(false);
    expect(heatNeedsAction('danger')).toBe(true);
    expect(heatNeedsAction('extreme_danger')).toBe(true);
  });
});

describe('assessHeat', () => {
  it('a humid Chennai afternoon is dangerous even at 34 °C', () => {
    const r = assessHeat(34, 70);
    expect(r.heatIndexC).toBeGreaterThan(39.4);
    expect(r.level).toBe('danger');
  });
});
