import { afterEach, describe, expect, it, vi } from 'vitest';

const ping = vi.fn();
vi.mock('@/src/server/repos/mongo', () => ({
  pingMongo: () => ping(),
  getMongoDb: vi.fn(() => {
    throw new Error('should not be reached when the ping fails');
  }),
}));

import { getDatabase, inMemoryDb } from '@/src/server/repos';
import { resetServerEnvForTests } from '@/src/server/env';

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnvForTests();
});

describe('getDatabase', () => {
  it('uses the seeded in-memory store when no MongoDB URI is set', () => {
    resetServerEnvForTests();
    expect(getDatabase()).toBe(inMemoryDb);
  });

  it('serves seeded data, and logs why, when MongoDB is unreachable', async () => {
    vi.stubEnv('MONGODB_URI', 'mongodb+srv://user:pw@blocked.example.net');
    resetServerEnvForTests();
    ping.mockRejectedValueOnce(new Error('querySrv ECONNREFUSED'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const db = getDatabase();
    expect(db).not.toBe(inMemoryDb);
    const org = await db.orgs.get('org-construction');

    expect(org?.name).toBeTruthy();
    expect(log.mock.calls[0]?.join(' ')).toContain('ECONNREFUSED');
    expect(log.mock.calls[0]?.join(' ')).not.toContain('pw@');
  });
});
