// Repositories: Factory & Singleton Access

import type { FairShiftDatabase } from './types';
import { inMemoryDb } from './memory';
import { getMongoDb, pingMongo } from './mongo';
import { serverEnv } from '../env';

export * from './types';
export * from './memory';

let backend: Promise<FairShiftDatabase> | null = null;

function resolveBackend(): Promise<FairShiftDatabase> {
  if (!backend) {
    backend = pingMongo()
      .then(() => getMongoDb())
      .catch((err) => {
        console.error(
          '[FairShift Data] MongoDB unreachable, serving seeded in-memory data instead:',
          err instanceof Error ? err.message : err,
        );
        return inMemoryDb;
      });
  }
  return backend;
}

/** Wraps every repo method so it runs against whichever backend resolved. */
function lazyDatabase(): FairShiftDatabase {
  const repos = Object.keys(inMemoryDb) as Array<keyof FairShiftDatabase>;
  const db = {} as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;
  for (const repo of repos) {
    db[repo] = new Proxy(
      {},
      {
        get:
          (_target, method: string) =>
          async (...args: unknown[]) => {
            const target = (await resolveBackend())[repo] as unknown as Record<
              string,
              (...a: unknown[]) => unknown
            >;
            return target[method](...args);
          },
      },
    );
  }
  return db as unknown as FairShiftDatabase;
}

let mongoBacked: FairShiftDatabase | null = null;

export function getDatabase(): FairShiftDatabase {
  if (serverEnv().dataBackend === 'mongodb') {
    return (mongoBacked ??= lazyDatabase());
  }
  return inMemoryDb;
}
