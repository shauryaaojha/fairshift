/**
 * Picks the data store. With MONGODB_URI set, every call goes to MongoDB, unless the first ping
 * fails (a blocked network, a paused cluster), in which case the app logs why and keeps serving
 * the seeded in-memory store instead of erroring. Without a URI, the in-memory store is used.
 */

import type { FairShiftDatabase } from './types';
import { inMemoryDb } from './memory';
import { getMongoDb, pingMongo } from './mongo';
import { serverEnv } from '../env';

export * from './types';
export * from './memory';

let backend: Promise<FairShiftDatabase> | null = null;

/** Resolved once per server instance; the ping decides between MongoDB and memory. */
function resolveBackend(): Promise<FairShiftDatabase> {
  backend ??= pingMongo()
    .then(() => getMongoDb())
    .catch((err) => {
      console.error(
        '[FairShift Data] MongoDB unreachable, serving seeded in-memory data instead:',
        err instanceof Error ? err.message : err,
      );
      return inMemoryDb;
    });
  return backend;
}

type RepoName = keyof FairShiftDatabase;
type RepoMethod = (...args: unknown[]) => Promise<unknown>;

/**
 * A repository whose methods wait for the backend to resolve, then call the same method on it.
 * Callers keep a synchronous `getDatabase()` even though choosing the backend is async.
 */
function deferredRepo<K extends RepoName>(name: K): FairShiftDatabase[K] {
  const handler: ProxyHandler<FairShiftDatabase[K]> = {
    get:
      (_target, method) =>
      async (...args: unknown[]) => {
        const repo = (await resolveBackend())[name];
        const call = Reflect.get(repo, method) as RepoMethod;
        return call.apply(repo, args);
      },
  };
  return new Proxy({} as FairShiftDatabase[K], handler);
}

/** Every repository, listed so the compiler flags one that is added to the interface but not here. */
function deferredDatabase(): FairShiftDatabase {
  return {
    orgs: deferredRepo('orgs'),
    sites: deferredRepo('sites'),
    workers: deferredRepo('workers'),
    admins: deferredRepo('admins'),
    shifts: deferredRepo('shifts'),
    hazards: deferredRepo('hazards'),
    feedback: deferredRepo('feedback'),
    feedbackBallots: deferredRepo('feedbackBallots'),
    skills: deferredRepo('skills'),
    payQueries: deferredRepo('payQueries'),
    wagePayments: deferredRepo('wagePayments'),
  };
}

let mongoBacked: FairShiftDatabase | null = null;

export function getDatabase(): FairShiftDatabase {
  if (serverEnv().dataBackend === 'mongodb') {
    return (mongoBacked ??= deferredDatabase());
  }
  return inMemoryDb;
}
