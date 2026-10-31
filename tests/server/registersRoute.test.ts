import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminContext } from '@/app/admin/_lib/context';
import { SECTORS } from '@/src/server/services/sectors';

let ctx: AdminContext;
vi.mock('@/app/admin/_lib/context', () => ({ getAdminContext: vi.fn(async () => ctx) }));

import { GET } from '@/app/admin/registers/[kind]/route';
import { getRegister } from '@/src/server/services/adminPages';
import { resetRateLimits } from '@/src/server/auth/rateLimit';
import { istDateKey } from '@/src/server/domain/time';

const call = (kind: string, query = '') =>
  GET(new Request(`http://localhost/admin/registers/${kind}${query}`), {
    params: Promise.resolve({ kind }),
  });

beforeEach(() => {
  resetRateLimits();
  ctx = {
    userId: 'admin-skyline',
    orgId: 'org-construction',
    sector: SECTORS.construction,
    allowedSectors: ['construction'],
  };
});

describe('GET /admin/registers/[kind]', () => {
  it('downloads the wage register for the session sector as CSV', async () => {
    const res = await call('wages');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const month = istDateKey(new Date()).slice(0, 7);
    expect(res.headers.get('content-disposition')).toBe(
      `attachment; filename="fairshift-wages-register-site-skyline-chennai-${month}.csv"`,
    );
    const body = await res.text();
    expect(body).toContain('Net pay (Rs)');
    expect(body).toContain('Ramesh Kumar');
    expect(body).not.toContain('Murugan'); // the other organisation never leaks in
  });

  it('downloads the attendance register for the college sector', async () => {
    ctx = { ...ctx, sector: SECTORS.college };
    const body = await (await call('attendance')).text();
    expect(body).toContain('Days present');
    expect(body).toContain('Murugan Swaminathan');
  });

  it('rejects an unknown register, a malformed month and a future month', async () => {
    expect((await call('salaries')).status).toBe(400);
    expect((await call('wages', '?month=2026-13')).status).toBe(400);
    expect((await call('wages', '?month=2999-01')).status).toBe(400);
  });

  it('rate-limits downloads per admin', async () => {
    for (let i = 0; i < 20; i++) await call('attendance');
    expect((await call('attendance')).status).toBe(429);
  });
});

describe('getRegister', () => {
  it('lists every active worker at the site once', async () => {
    const { csv } = await getRegister('construction', 'attendance');
    const lines = csv.trim().split('\r\n');
    expect(lines.length - 1).toBe(30); // 30 construction workers in the seed
  });
});
