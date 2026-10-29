// Runs in the plain Node project on purpose: this is about what the server renders.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/w/actions', () => ({
  checkInAction: vi.fn(),
  checkOutAction: vi.fn(),
  reportHazardAction: vi.fn(),
  submitFeedbackAction: vi.fn(),
}));

import { OfflineSync } from '@/src/components/worker/OfflineSync';
import { en } from '@/src/i18n/en';

describe('OfflineSync on the server', () => {
  it('does not render the offline banner, even though Node defines navigator without onLine', () => {
    expect(typeof navigator).toBe('object');
    expect((navigator as { onLine?: boolean }).onLine).toBeUndefined();

    const html = renderToString(createElement(OfflineSync, { workerId: 'worker-ramesh' }));

    expect(html).not.toContain(en['offline.bannerOffline']);
  });
});
