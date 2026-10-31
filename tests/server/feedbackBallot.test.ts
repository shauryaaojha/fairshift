import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));

import { ballotId } from '@/src/server/domain/feedbackBallot';
import { workerService } from '@/src/server/services/workerService';
import { getDatabase } from '@/src/server/repos';
import { AppError } from '@/src/shared/errors';

const answers = {
  managerRespect: 2,
  safetyRating: 2,
  payFairness: 1,
  workloadRating: 2,
  comment: 'Supervisor shouts when we ask about pay.',
};

/** Two workers of the same team on one site, untouched by other tests. */
async function teammates() {
  const workers = await getDatabase().workers.listBySite('site-skyline-chennai');
  const team = workers.find((w) => w.id === 'worker-const-20')!.team;
  const [a, b] = workers.filter((w) => w.team === team && w.id !== 'worker-ramesh').slice(-2);
  return { a, b, siteId: a.siteId };
}

describe('feedback ballot id', () => {
  it('is a keyed one-way hash of worker, team and week', () => {
    const id = ballotId('secret', 'worker-a', 'Masonry', '2026-W44');
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(id).not.toContain('worker-a');
    expect(ballotId('secret', 'worker-a', 'Masonry', '2026-W44')).toBe(id);
    expect(ballotId('secret', 'worker-b', 'Masonry', '2026-W44')).not.toBe(id);
    expect(ballotId('secret', 'worker-a', 'Masonry', '2026-W45')).not.toBe(id);
    expect(ballotId('secret', 'worker-a', 'Electrical', '2026-W44')).not.toBe(id);
    expect(ballotId('other secret', 'worker-a', 'Masonry', '2026-W44')).not.toBe(id);
  });
});

describe('one answer per person per week', () => {
  it('refuses a second answer, so one worker cannot open the team alone', async () => {
    const { a, b, siteId } = await teammates();
    const db = getDatabase();
    const before = (await db.feedback.listBySite(siteId)).length;

    expect(await workerService.hasGivenFeedback(a.id)).toBe(false);
    await workerService.submitFeedback(a.id, { siteId, ...answers });
    expect(await workerService.hasGivenFeedback(a.id)).toBe(true);

    for (let i = 0; i < 2; i++) {
      await expect(
        workerService.submitFeedback(a.id, { siteId, ...answers }),
      ).rejects.toMatchObject({ code: 'feedback_already_given' });
    }
    const err = await workerService.submitFeedback(a.id, { siteId, ...answers }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).permanent).toBe(true);

    // A teammate still has their own voice.
    expect(await workerService.hasGivenFeedback(b.id)).toBe(false);
    await workerService.submitFeedback(b.id, { siteId, ...answers });

    const after = await db.feedback.listBySite(siteId);
    expect(after.length).toBe(before + 2);
    // Neither the answer nor anything beside it names the worker.
    for (const f of after.slice(0, 2)) {
      expect(JSON.stringify(f)).not.toContain(a.id);
      expect(JSON.stringify(f)).not.toContain(b.id);
    }
  });

  it('keeps a replayed offline answer idempotent instead of refusing it', async () => {
    const workers = await getDatabase().workers.listBySite('site-skyline-chennai');
    const w = workers.find((x) => x.id === 'worker-const-21')!;
    const input = { siteId: w.siteId, ...answers, clientId: 'fb-ballot-replay-1' };
    const first = await workerService.submitFeedback(w.id, input);
    const again = await workerService.submitFeedback(w.id, input);
    expect(again.id).toBe(first.id);
  });
});
