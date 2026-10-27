// ============================================================
// FairShift — Repositories: Factory & Singleton Access
// MongoDB when MONGODB_URI is set (production on Vercel), otherwise the
// seeded in-memory store (local development and tests, no credentials needed).
// ============================================================

import type { FairShiftDatabase } from './types';
import { inMemoryDb } from './memory';
import { getMongoDb } from './mongo';

export * from './types';
export * from './memory';

export function getDatabase(): FairShiftDatabase {
  if (process.env.DATA_BACKEND !== 'memory' && process.env.MONGODB_URI) {
    return getMongoDb();
  }
  return inMemoryDb;
}
