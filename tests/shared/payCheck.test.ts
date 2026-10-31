import { describe, expect, it } from 'vitest';
import { MAX_RUPEES, checkPaid, parseRupees } from '@/src/shared/payCheck';

describe('parseRupees', () => {
  it('reads the ways a worker writes an amount', () => {
    expect(parseRupees('8500')).toBe(8500);
    expect(parseRupees('8,500')).toBe(8500);
    expect(parseRupees(' ₹ 8,500 ')).toBe(8500);
    expect(parseRupees('Rs. 8500')).toBe(8500);
    expect(parseRupees('8500.50')).toBe(8500.5);
  });

  it('reads Devanagari and Tamil digits', () => {
    expect(parseRupees('८५००')).toBe(8500);
    expect(parseRupees('௮௫௦௦')).toBe(8500);
  });

  it('refuses anything that is not a plain amount', () => {
    for (const bad of ['', 'abc', '-500', '85o0', '8500.505', '1e5', '0x10', '१२.३४५']) {
      expect(parseRupees(bad), bad).toBeNull();
    }
    expect(parseRupees(String(MAX_RUPEES))).toBe(MAX_RUPEES);
    expect(parseRupees(String(MAX_RUPEES + 1))).toBeNull();
  });
});

describe('checkPaid', () => {
  it('treats a difference under one rupee as a match', () => {
    expect(checkPaid(8755, 8755)).toEqual({ status: 'match', gap: 0 });
    expect(checkPaid(8755.4, 8755)).toEqual({ status: 'match', gap: 0 });
  });

  it('says how much short or over, to the rupee', () => {
    expect(checkPaid(8755, 8000)).toEqual({ status: 'short', gap: 755 });
    expect(checkPaid(8755, 9000.6)).toEqual({ status: 'over', gap: 246 });
  });
});
