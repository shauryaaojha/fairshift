import { beforeEach, describe, expect, it } from 'vitest';
import { setGeminiForTests } from '@/src/server/ai/client';
import { workerService, STALE_OPEN_SHIFT_MS } from '@/src/server/services/workerService';
import { getDatabase } from '@/src/server/repos';
import { generateSiteQrCode } from '@/src/server/domain/qrCode';
import { AppError } from '@/src/shared/errors';
import { verifySession } from '@/src/server/auth/session';
import type { Site, Worker } from '@/src/shared/types';

const db = getDatabase();
let worker: Worker;
let site: Site;

/** A fresh worker with no shifts, so each test starts from a clean record. */
beforeEach(async () => {
  const ramesh = (await db.workers.getById('worker-ramesh'))!;
  site = (await db.sites.get(ramesh.siteId))!;
  worker = {
    ...ramesh,
    id: `worker-test-${Math.random().toString(36).slice(2, 8)}`,
    phone: `90000${Math.floor(Math.random() * 1e5)
      .toString()
      .padStart(5, '0')}`,
    name: 'Test Worker',
  };
  await db.workers.save(worker);
});

const code = () => generateSiteQrCode(site.qrSecret).code;

async function expectCode(promise: Promise<unknown>, codeName: AppError['code']) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await promise.catch((err: AppError) => expect(err.code).toBe(codeName));
}

describe('login', () => {
  it('signs a worker session for the demo phone and PIN, without the PIN hash', async () => {
    const { worker: me, token } = await workerService.login('9876543210', '1234');
    expect(me).not.toHaveProperty('pinHash');
    expect(verifySession(token)).toMatchObject({ userId: 'worker-ramesh', role: 'worker' });
  });

  it('rejects a wrong PIN, an unknown phone and an inactive account the same way', async () => {
    await expectCode(workerService.login('9876543210', '0000'), 'invalid_credentials');
    await expectCode(workerService.login('9999999999', '1234'), 'invalid_credentials');
    await db.workers.save({ ...worker, active: false });
    await expectCode(workerService.login(worker.phone, '1234'), 'invalid_credentials');
  });
});

describe('checkIn and checkOut', () => {
  it('checks in with the live gate code and returns the open shift on a second scan', async () => {
    const first = await workerService.checkIn(worker.id, { siteId: site.id, code: code() });
    expect(first.shift).toMatchObject({ workerId: worker.id, method: 'qr', checkOut: null });
    const again = await workerService.checkIn(worker.id, { siteId: site.id, code: code() });
    expect(again).toMatchObject({ message: 'Already checked in', shift: { id: first.shift.id } });
  });

  it('rejects a wrong code, and GPS from outside the fence', async () => {
    await expectCode(
      workerService.checkIn(worker.id, { siteId: site.id, code: '000000' }),
      'invalid_code',
    );
    await expectCode(
      workerService.checkIn(worker.id, { siteId: site.id, lat: site.lat + 0.05, lng: site.lng }),
      'outside_geofence',
    );
  });

  it('accepts GPS at the gate', async () => {
    const { shift } = await workerService.checkIn(worker.id, {
      siteId: site.id,
      lat: site.lat,
      lng: site.lng,
    });
    expect(shift.method).toBe('gps');
  });

  it("refuses another organisation's site", async () => {
    const college = (await db.sites.list()).find((s) => s.orgId !== worker.orgId)!;
    await expectCode(
      workerService.checkIn(worker.id, { siteId: college.id, code: '123456' }),
      'not_found',
    );
  });

  it('closes a forgotten shift at zero hours instead of paying for it', async () => {
    const old = new Date(Date.now() - STALE_OPEN_SHIFT_MS - 60_000).toISOString();
    await db.shifts.create({
      id: `shift-stale-${worker.id}`,
      workerId: worker.id,
      siteId: site.id,
      orgId: worker.orgId,
      checkIn: old,
      checkOut: null,
      method: 'qr',
    });
    const { shift } = await workerService.checkIn(worker.id, { siteId: site.id, code: code() });
    expect(shift.id).not.toBe(`shift-stale-${worker.id}`);
    const stale = await db.shifts.getById(`shift-stale-${worker.id}`);
    expect(stale?.checkOut).toBe(old);
  });

  it('checks out the open shift and is idempotent on replay', async () => {
    await workerService.checkIn(worker.id, { siteId: site.id, code: code() });
    const out = await workerService.checkOut(worker.id, { clientId: 'client-out-1' });
    expect(out.checkOut).not.toBeNull();
    const replay = await workerService.checkOut(worker.id, { clientId: 'client-out-1' });
    expect(replay.id).toBe(out.id);
  });

  it("will not check out with no open shift, or someone else's shift", async () => {
    await expectCode(workerService.checkOut(worker.id), 'not_found');
    const { shift } = await workerService.checkIn(worker.id, { siteId: site.id, code: code() });
    await expectCode(workerService.checkOut('worker-ramesh', { shiftId: shift.id }), 'not_found');
  });
});

describe('reportHazard', () => {
  it('drops the reporter id for an anonymous report and stores a summary', async () => {
    setGeminiForTests(null);
    const h = await workerService.reportHazard(worker.id, {
      siteId: site.id,
      category: 'Electric',
      description: 'Live wire near the lift shaft',
      severity: 'medium',
      anonymous: true,
    });
    expect(h.reporterId).toBeNull();
    // Unguessable id: prefix plus a v4 UUID from the OS CSPRNG.
    expect(h.id).toMatch(
      /^hazard-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(h.status).toBe('reported');
    expect(h.aiSummary).toContain('Live wire');
    // Danger words start the 1-hour clock even though the worker tapped "medium".
    expect(h.aiSuggestedSeverity).toBe('critical');
    expect(h.severity).toBe('critical');
    setGeminiForTests(undefined);
  });

  it('keeps an anonymous report time only to the IST hour, and a named one exactly', async () => {
    setGeminiForTests(null);
    const capturedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const base = { siteId: site.id, category: 'Other', description: 'Water cooler empty' };
    const anon = await workerService.reportHazard(worker.id, {
      ...base,
      severity: 'low',
      anonymous: true,
      capturedAt,
    });
    const named = await workerService.reportHazard(worker.id, {
      ...base,
      severity: 'low',
      anonymous: false,
      capturedAt,
    });
    expect(named.reportedAt).toBe(capturedAt);
    expect(named.severity).toBe('low');
    // Whole IST hour (IST is UTC+5:30, so :30 UTC), never later than the real time.
    expect(new Date(anon.reportedAt).getUTCMinutes()).toBe(30);
    expect(new Date(anon.reportedAt).getUTCSeconds()).toBe(0);
    expect(Date.parse(anon.reportedAt)).toBeLessThanOrEqual(Date.parse(capturedAt));
    expect(Date.parse(capturedAt) - Date.parse(anon.reportedAt)).toBeLessThan(60 * 60 * 1000);
    setGeminiForTests(undefined);
  });
});

describe('giveHazardVerdict (two-key closure)', () => {
  async function resolvedReportBy(reporterId: string | null) {
    const h = await workerService.reportHazard(worker.id, {
      siteId: site.id,
      category: 'Fall',
      description: 'Broken ladder rung on the second landing',
      severity: 'high',
      anonymous: false,
    });
    return db.hazards.update({
      ...h,
      reporterId,
      anonymous: reporterId === null,
      status: 'resolved',
      acknowledgedAt: new Date().toISOString(),
      resolvedAt: new Date().toISOString(),
      reporterVerdict: null,
    });
  }

  it('closes the report when the reporter confirms the fix', async () => {
    const h = await resolvedReportBy(worker.id);
    const after = await workerService.giveHazardVerdict(worker.id, h.id, 'fixed');
    expect(after).toMatchObject({ status: 'resolved', reporterVerdict: 'fixed' });
    // A second answer is refused: the report no longer waits for one.
    await expectCode(
      workerService.giveHazardVerdict(worker.id, h.id, 'not_fixed'),
      'verdict_not_allowed',
    );
  });

  it('reopens the report as escalated when the reporter says it is not fixed', async () => {
    const h = await resolvedReportBy(worker.id);
    const after = await workerService.giveHazardVerdict(worker.id, h.id, 'not_fixed');
    expect(after).toMatchObject({ status: 'escalated', resolvedAt: null, reopenCount: 1 });
    expect((await db.hazards.getById(h.id))?.reopenedAt).toBeTruthy();
  });

  it("treats someone else's or an anonymous report as not found", async () => {
    const mine = await resolvedReportBy(worker.id);
    await expectCode(
      workerService.giveHazardVerdict('worker-ramesh', mine.id, 'fixed'),
      'not_found',
    );
    const anon = await resolvedReportBy(null);
    await expectCode(workerService.giveHazardVerdict(worker.id, anon.id, 'fixed'), 'not_found');
    await expectCode(
      workerService.giveHazardVerdict(worker.id, 'hazard-nope', 'fixed'),
      'not_found',
    );
  });
});

describe('submitFeedback', () => {
  it('scrubs names of people on the roster from the comment and stores no worker id', async () => {
    const fb = await workerService.submitFeedback(worker.id, {
      siteId: site.id,
      managerRespect: 2,
      safetyRating: 3,
      payFairness: 1,
      workloadRating: 2,
      comment: 'Ramesh Kumar shouts at us, call me on 9876543210',
    });
    expect(fb.comment).not.toContain('Ramesh');
    expect(fb.comment).not.toContain('9876543210');
    expect(fb).not.toHaveProperty('workerId');
    expect(fb.isoWeek).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe('reads', () => {
  it('returns hours, payslip and skills for a worker', async () => {
    const hours = await workerService.getMyHours('worker-ramesh');
    expect(hours.otSummary.regularHours).toBeGreaterThan(0);
    const pay = await workerService.getMyPayslip('worker-ramesh');
    expect(pay.net).toBe(pay.gross - pay.totalDeductions);
    expect(Array.isArray(await workerService.getMySkills('worker-ramesh'))).toBe(true);
    expect(await workerService.getProfile('nobody')).toBeNull();
    await expectCode(workerService.getMyPayslip('nobody'), 'not_found');
  });
});
