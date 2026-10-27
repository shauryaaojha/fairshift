import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

const mockContext = {
  worker: {
    id: 'worker-offline-tester',
    orgId: 'org-construction',
    siteId: 'site-skyline-chennai',
    name: 'Offline Tester',
    phone: '9988776655',
    role: 'mason' as const,
    payType: 'daily' as const,
    basePay: 800,
    allowances: 100,
    team: 'Beta',
    locale: 'en' as const,
    active: true,
  },
  site: {
    id: 'site-skyline-chennai',
    orgId: 'org-construction',
    name: 'Skyline Towers Chennai',
    lat: 13.0827,
    lng: 80.2707,
    radiusMetres: 200,
    qrSecret: 'c0ffee1234567890abcdef',
  },
};

let currentWorkerContext: typeof mockContext | null = mockContext;

import type * as WorkerViewsModule from '@/src/server/services/workerViews';

vi.mock('@/src/server/services/workerViews', async (importOriginal) => {
  const actual = await importOriginal<typeof WorkerViewsModule>();
  return {
    ...actual,
    getWorkerContext: vi.fn(async () => currentWorkerContext),
  };
});

import {
  checkInAction,
  checkOutAction,
  reportHazardAction,
  submitFeedbackAction,
} from '../../app/w/actions';
import { getDatabase } from '../../src/server/repos';
import { resetRateLimits } from '../../src/server/auth/rateLimit';
import { generateSiteQrCode, verifySiteQrCode } from '../../src/server/domain/qrCode';
import { MAX_OFFLINE_AGE_MS } from '../../src/server/domain/offline';

describe('Server: Offline Captured Actions', () => {
  const db = getDatabase();

  beforeEach(async () => {
    resetRateLimits();
    currentWorkerContext = {
      ...mockContext,
      worker: {
        ...mockContext.worker,
        id: `worker-offline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      },
    };
    // Ensure worker and site exist in DB
    await db.workers.save({
      ...currentWorkerContext.worker,
      pinHash: 'dummy-hash',
    });
    await db.sites.save(currentWorkerContext.site);
  });

  it('accepts a QR code valid at capture time even if expired now', async () => {
    const site = currentWorkerContext!.site;
    const now = Date.now();
    // Captured 15 minutes ago (QR rotates every 60s, so it is 15 cycles in the past)
    const captureTimeMs = now - 15 * 60 * 1000;
    const capturedAt = new Date(captureTimeMs).toISOString();

    const qrResult = generateSiteQrCode(site.qrSecret, captureTimeMs);

    // Verify it is expired relative to server's current time
    expect(verifySiteQrCode(qrResult.code, site.qrSecret, now)).toBe(false);

    const result = await checkInAction({
      code: qrResult.code,
      capturedAt,
      clientId: 'offline-qr-client-1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.shiftId).toBeDefined();
      const shift = await db.shifts.getById(result.shiftId);
      expect(shift?.checkIn).toBe(capturedAt);
      expect(shift?.clientId).toBe('offline-qr-client-1');
      expect(shift?.method).toBe('qr');
    }
  });

  it('rejects a forged future time permanently', async () => {
    const site = currentWorkerContext!.site;
    // 10 minutes into the future (beyond 2 minute clock skew)
    const futureCaptureTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const qrResult = generateSiteQrCode(site.qrSecret, Date.parse(futureCaptureTime));

    // Check-in with future time
    const checkinRes = await checkInAction({
      code: qrResult.code,
      capturedAt: futureCaptureTime,
      clientId: 'forged-future-checkin',
    });

    expect(checkinRes.ok).toBe(false);
    if (!checkinRes.ok) {
      expect(checkinRes.permanent).toBe(true);
      expect(checkinRes.retryable).toBe(false);
      expect(checkinRes.reason).toBe('Invalid capture time: future');
    }

    // Hazard report with future time
    const hazardRes = await reportHazardAction({
      category: 'Trip Hazard',
      description: 'Scaffolding plank loose',
      severity: 'high',
      anonymous: false,
      capturedAt: futureCaptureTime,
      clientId: 'forged-future-hazard',
    });

    expect(hazardRes.ok).toBe(false);
    if (!hazardRes.ok) {
      expect(hazardRes.permanent).toBe(true);
      expect(hazardRes.retryable).toBe(false);
      expect(hazardRes.reason).toBe('Invalid capture time: future');
    }

    // Feedback with future time
    const feedbackRes = await submitFeedbackAction({
      managerRespect: 4,
      safetyRating: 4,
      payFairness: 4,
      workloadRating: 4,
      comment: 'Future test',
      capturedAt: futureCaptureTime,
      clientId: 'forged-future-fb',
    });

    expect(feedbackRes.ok).toBe(false);
    if (!feedbackRes.ok) {
      expect(feedbackRes.permanent).toBe(true);
      expect(feedbackRes.retryable).toBe(false);
      expect(feedbackRes.reason).toBe('Invalid capture time: future');
    }
  });

  it('rejects capture time older than 24 hours permanently', async () => {
    const site = currentWorkerContext!.site;
    const staleCaptureTime = new Date(Date.now() - (MAX_OFFLINE_AGE_MS + 60 * 1000)).toISOString();
    const qrResult = generateSiteQrCode(site.qrSecret, Date.parse(staleCaptureTime));

    const checkinRes = await checkInAction({
      code: qrResult.code,
      capturedAt: staleCaptureTime,
      clientId: 'stale-checkin',
    });

    expect(checkinRes.ok).toBe(false);
    if (!checkinRes.ok) {
      expect(checkinRes.permanent).toBe(true);
      expect(checkinRes.retryable).toBe(false);
      expect(checkinRes.reason).toBe('Invalid capture time: too_old');
    }
  });

  it('returns the same record on replay with the same clientId (checkin, checkout, hazard, feedback)', async () => {
    const site = currentWorkerContext!.site;
    const workerId = currentWorkerContext!.worker.id;
    const checkinTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const qr = generateSiteQrCode(site.qrSecret, Date.parse(checkinTime));

    // 1. Checkin Idempotency
    const checkinClientId = `client-checkin-${Date.now()}`;
    const checkin1 = await checkInAction({
      code: qr.code,
      capturedAt: checkinTime,
      clientId: checkinClientId,
    });
    expect(checkin1.ok).toBe(true);
    if (!checkin1.ok) return;

    const checkin2 = await checkInAction({
      code: qr.code,
      capturedAt: checkinTime,
      clientId: checkinClientId,
    });
    expect(checkin2.ok).toBe(true);
    if (!checkin2.ok) return;

    expect(checkin2.shiftId).toBe(checkin1.shiftId);
    expect(checkin2.already).toBe(true);

    const workerShifts = await db.shifts.listByWorker(workerId);
    const matchingShifts = workerShifts.filter((s) => s.clientId === checkinClientId);
    expect(matchingShifts.length).toBe(1);

    // 2. Checkout Idempotency
    const checkoutTime = new Date(Date.parse(checkinTime) + 20 * 60 * 1000).toISOString();
    const checkoutClientId = `client-checkout-${Date.now()}`;

    const checkout1 = await checkOutAction({
      shiftId: checkin1.shiftId,
      capturedAt: checkoutTime,
      clientId: checkoutClientId,
    });
    expect(checkout1.ok).toBe(true);
    if (!checkout1.ok) return;

    const checkout2 = await checkOutAction({
      shiftId: checkin1.shiftId,
      capturedAt: checkoutTime,
      clientId: checkoutClientId,
    });
    expect(checkout2.ok).toBe(true);
    if (!checkout2.ok) return;

    expect(checkout2.shiftId).toBe(checkout1.shiftId);

    const updatedShift = await db.shifts.getById(checkin1.shiftId);
    expect(updatedShift?.checkOut).toBe(checkoutTime);
    expect(updatedShift?.checkOutClientId).toBe(checkoutClientId);

    // 3. Hazard Idempotency
    const hazardClientId = `client-hazard-${Date.now()}`;
    const hazardCaptureTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const hazard1 = await reportHazardAction({
      category: 'Electrical',
      description: 'Water leaking near panel board',
      severity: 'critical',
      anonymous: true,
      capturedAt: hazardCaptureTime,
      clientId: hazardClientId,
    });
    expect(hazard1.ok).toBe(true);
    if (!hazard1.ok) return;

    const hazard2 = await reportHazardAction({
      category: 'Electrical',
      description: 'Water leaking near panel board',
      severity: 'critical',
      anonymous: true,
      capturedAt: hazardCaptureTime,
      clientId: hazardClientId,
    });
    expect(hazard2.ok).toBe(true);
    if (!hazard2.ok) return;

    expect(hazard2.id).toBe(hazard1.id);

    const siteHazards = await db.hazards.listBySite(site.id);
    const matchingHazards = siteHazards.filter((h) => h.clientId === hazardClientId);
    expect(matchingHazards.length).toBe(1);

    // 4. Feedback Idempotency
    const feedbackClientId = `client-feedback-${Date.now()}`;
    const feedbackCaptureTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const siteFeedbackBefore = await db.feedback.listBySite(site.id);
    const beforeCount = siteFeedbackBefore.filter((f) => f.clientId === feedbackClientId).length;
    expect(beforeCount).toBe(0);

    const fb1 = await submitFeedbackAction({
      managerRespect: 5,
      safetyRating: 5,
      payFairness: 4,
      workloadRating: 3,
      comment: 'Safe working conditions',
      capturedAt: feedbackCaptureTime,
      clientId: feedbackClientId,
    });
    expect(fb1.ok).toBe(true);

    const fb2 = await submitFeedbackAction({
      managerRespect: 5,
      safetyRating: 5,
      payFairness: 4,
      workloadRating: 3,
      comment: 'Safe working conditions',
      capturedAt: feedbackCaptureTime,
      clientId: feedbackClientId,
    });
    expect(fb2.ok).toBe(true);

    const siteFeedbackAfter = await db.feedback.listBySite(site.id);
    const matchingFb = siteFeedbackAfter.filter((f) => f.clientId === feedbackClientId);
    expect(matchingFb.length).toBe(1);
    expect(matchingFb[0].clientId).toBe(feedbackClientId);
  });

  it('sets shift checkIn, checkOut, and hazard reportedAt exactly equal to capturedAt', async () => {
    const site = currentWorkerContext!.site;
    const inTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const outTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const hazardTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const qr = generateSiteQrCode(site.qrSecret, Date.parse(inTime));

    const checkinRes = await checkInAction({
      code: qr.code,
      capturedAt: inTime,
      clientId: 'time-exact-in',
    });
    expect(checkinRes.ok).toBe(true);
    if (!checkinRes.ok) return;

    const checkoutRes = await checkOutAction({
      shiftId: checkinRes.shiftId,
      capturedAt: outTime,
      clientId: 'time-exact-out',
    });
    expect(checkoutRes.ok).toBe(true);

    const shift = await db.shifts.getById(checkinRes.shiftId);
    expect(shift?.checkIn).toBe(inTime);
    expect(shift?.checkOut).toBe(outTime);

    const hazardRes = await reportHazardAction({
      category: 'Slip',
      description: 'Wet tiles near entrance',
      severity: 'medium',
      anonymous: false,
      capturedAt: hazardTime,
      clientId: 'time-exact-hazard',
    });
    expect(hazardRes.ok).toBe(true);
    if (!hazardRes.ok) return;

    const hazard = await db.hazards.getById(hazardRes.id);
    expect(hazard?.reportedAt).toBe(hazardTime);
  });

  it('rejects shift checkOut before checkIn permanently', async () => {
    const site = currentWorkerContext!.site;
    const inTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    // Out time is 30 minutes BEFORE in time
    const invalidOutTime = new Date(Date.parse(inTime) - 30 * 60 * 1000).toISOString();

    const qr = generateSiteQrCode(site.qrSecret, Date.parse(inTime));
    const checkinRes = await checkInAction({
      code: qr.code,
      capturedAt: inTime,
      clientId: 'before-test-in',
    });
    expect(checkinRes.ok).toBe(true);
    if (!checkinRes.ok) return;

    const checkoutRes = await checkOutAction({
      shiftId: checkinRes.shiftId,
      capturedAt: invalidOutTime,
      clientId: 'before-test-out',
    });

    expect(checkoutRes.ok).toBe(false);
    if (!checkoutRes.ok) {
      expect(checkoutRes.permanent).toBe(true);
      expect(checkoutRes.retryable).toBe(false);
      expect(checkoutRes.reason).toBe('Check-out time must be after check-in time');
    }
  });

  it('classifies auth failures as permanent', async () => {
    currentWorkerContext = null;

    const res = await checkInAction({ code: '123456' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.permanent).toBe(true);
      expect(res.retryable).toBe(false);
      expect(res.code).toBe('auth');
    }

    const outRes = await checkOutAction();
    expect(outRes.ok).toBe(false);
    if (!outRes.ok) {
      expect(outRes.permanent).toBe(true);
      expect(outRes.retryable).toBe(false);
    }
  });
});
