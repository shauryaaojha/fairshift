import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/w') }));

import { isTabActive, tabsHidden } from '@/src/components/worker/WorkerTabs';

describe('worker tab bar', () => {
  it('stays out of the way on sign-in and the printable letter', () => {
    expect(tabsHidden('/w/login')).toBe(true);
    expect(tabsHidden('/w/login/pin')).toBe(true);
    expect(tabsHidden('/w/pay/query/payq-2/letter')).toBe(true);
    expect(tabsHidden('/w')).toBe(false);
    expect(tabsHidden('/w/pay/query/payq-2')).toBe(false);
  });

  it('marks Home only on the home screen, and other tabs on their sub-pages too', () => {
    expect(isTabActive('/w', '/w')).toBe(true);
    expect(isTabActive('/w/pay', '/w')).toBe(false);
    expect(isTabActive('/w/pay', '/w/pay')).toBe(true);
    expect(isTabActive('/w/pay/query/payq-2', '/w/pay')).toBe(true);
    expect(isTabActive('/w/hazard/hz-1', '/w/hazard')).toBe(true);
    // A shared prefix is not a sub-page.
    expect(isTabActive('/w/hazards', '/w/hazard')).toBe(false);
  });
});
