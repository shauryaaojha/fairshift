/**
 * "Did I get the right amount?": the worker types what they got in hand and the app compares it
 * with the take-home pay the payslip engine worked out. Runs in the browser and keeps nothing.
 * Pure.
 */

import type { PayQueryReason } from './types';

/** Why a worker raises a pay query, in the order the form shows them. */
export const PAY_QUERY_REASONS = [
  'short_pay',
  'unpaid_overtime',
  'wrong_deduction',
  'late_pay',
] as const satisfies readonly PayQueryReason[];

export type PayCheckStatus = 'match' | 'short' | 'over';

export interface PayCheck {
  status: PayCheckStatus;
  /** Absolute difference in rupees, rounded to the rupee. */
  gap: number;
}

/** Differences under a rupee are rounding, not a pay problem. */
export const PAY_MATCH_TOLERANCE = 1;

/** Up to ₹99,99,999: more than a year's wage, so a stray extra digit is caught. */
export const MAX_RUPEES = 9_999_999;

const DIGIT_BLOCKS = [
  0x0966, // Devanagari ०
  0x0be6, // Tamil ௦
];

/** Devanagari and Tamil digits become ASCII, so a worker can type in their own script. */
function toAsciiDigits(text: string): string {
  return text.replace(/[०-९௦-௯]/g, (ch) => {
    const code = ch.charCodeAt(0);
    const zero = DIGIT_BLOCKS.find((z) => code >= z && code <= z + 9)!;
    return String(code - zero);
  });
}

/**
 * Reads an amount like "8,500", "₹ 8500", "8500.50" or "८५००". Returns null for anything else,
 * including negatives, more than two decimals and amounts above `MAX_RUPEES`.
 */
export function parseRupees(input: string): number | null {
  const cleaned = toAsciiDigits(input)
    .replace(/[₹,\s]/g, '')
    .replace(/^rs\.?/i, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  return amount <= MAX_RUPEES ? amount : null;
}

export function checkPaid(expectedNet: number, received: number): PayCheck {
  const diff = received - expectedNet;
  if (Math.abs(diff) < PAY_MATCH_TOLERANCE) return { status: 'match', gap: 0 };
  return { status: diff < 0 ? 'short' : 'over', gap: Math.round(Math.abs(diff)) };
}
