// ============================================================
// FairShift — Repositories: Factory & Singleton Access
// Selects adapter based on DATA_BACKEND=memory|firestore (default memory)
// ============================================================

import type { FairShiftDatabase } from './types';
import { inMemoryDb } from './memory';
import { getFirestoreDb } from './firestore';

export * from './types';
export * from './memory';

export function getDatabase(): FairShiftDatabase {
  if (process.env.DATA_BACKEND === 'firestore') {
    return getFirestoreDb();
  }
  return inMemoryDb;
}
