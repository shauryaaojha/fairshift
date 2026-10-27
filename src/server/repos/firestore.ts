// ============================================================
// FairShift — Repositories: Cloud Firestore Adapter
// Application Default Credentials (ADC) ONLY — zero keys in repo.
// On Cloud Run, ADC resolves to the service account.
// One top-level collection per repo; document id = entity id.
// All queries are single-field equality, so NO composite indexes are
// required; secondary filters/sorts happen in memory.
// ============================================================

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { FairShiftDatabase } from './types';
import type {
  Org,
  Site,
  Worker,
  Admin,
  Shift,
  HazardReport,
  FeedbackSubmission,
  SkillRecord,
} from '../../shared/types';
import { generateSeedData } from '../seed/seed';
import { withLiveHazardStatus, sortHazardsNewestFirst } from './hazardStatus';

const MAX_BATCH = 500;

const COLLECTIONS = {
  orgs: 'orgs',
  sites: 'sites',
  workers: 'workers',
  admins: 'admins',
  shifts: 'shifts',
  hazards: 'hazards',
  feedback: 'feedback',
  skills: 'skills',
} as const;

/** Firestore rejects `undefined`; strip it recursively. */
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => clean(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = clean(v);
    }
    return out as T;
  }
  return value;
}

function byCheckInDesc(a: Shift, b: Shift): number {
  return new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime();
}

function initFirestore(): Firestore {
  try {
    if (getApps().length === 0) {
      initializeApp(); // Application Default Credentials only
    }
    return getFirestore();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[FairShift Data] DATA_BACKEND=firestore but Firestore initialisation failed ` +
        `(Application Default Credentials required): ${msg}`
    );
  }
}

/**
 * Seeds Firestore from the deterministic seed data if the `orgs`
 * collection is empty. Returns true when seed data was written.
 */
export async function seedFirestoreIfEmpty(db: Firestore): Promise<boolean> {
  const existing = await db.collection(COLLECTIONS.orgs).limit(1).get();
  if (!existing.empty) return false;

  const data = await generateSeedData();
  const writes: Array<{ col: string; id: string; doc: object }> = [];
  for (const key of Object.keys(COLLECTIONS) as Array<keyof typeof COLLECTIONS>) {
    for (const item of data[key] as Array<{ id: string }>) {
      writes.push({ col: COLLECTIONS[key], id: item.id, doc: item });
    }
  }

  for (let i = 0; i < writes.length; i += MAX_BATCH) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + MAX_BATCH)) {
      batch.set(db.collection(w.col).doc(w.id), clean(w.doc));
    }
    await batch.commit();
  }
  return true;
}

class FirestoreFairShiftDb implements FairShiftDatabase {
  private seedPromise: Promise<void> | null = null;

  constructor(private readonly db: Firestore) {}

  /** Seeds once per process (cached promise); retried if it failed. */
  private ensureSeeded(): Promise<void> {
    if (!this.seedPromise) {
      this.seedPromise = seedFirestoreIfEmpty(this.db)
        .then((seeded) => {
          if (seeded) console.log('[FairShift Data] Seeded empty Firestore database');
        })
        .catch((err) => {
          this.seedPromise = null;
          throw err;
        });
    }
    return this.seedPromise;
  }

  private async getDoc<T>(col: string, id: string): Promise<T | null> {
    await this.ensureSeeded();
    const snap = await this.db.collection(col).doc(id).get();
    return snap.exists ? (snap.data() as T) : null;
  }

  private async query<T>(col: string, field: string, value: unknown): Promise<T[]> {
    await this.ensureSeeded();
    const snap = await this.db.collection(col).where(field, '==', value).get();
    return snap.docs.map((d) => d.data() as T);
  }

  private async put<T extends { id: string }>(col: string, item: T): Promise<T> {
    await this.ensureSeeded();
    await this.db.collection(col).doc(item.id).set(clean(item));
    return item;
  }

  private async listAll<T>(col: string): Promise<T[]> {
    await this.ensureSeeded();
    const snap = await this.db.collection(col).get();
    return snap.docs.map((d) => d.data() as T);
  }

  orgs = {
    get: (id: string) => this.getDoc<Org>(COLLECTIONS.orgs, id),
    list: () => this.listAll<Org>(COLLECTIONS.orgs),
    save: async (org: Org) => {
      await this.put(COLLECTIONS.orgs, org);
    },
  };

  sites = {
    get: (id: string) => this.getDoc<Site>(COLLECTIONS.sites, id),
    listByOrg: (orgId: string) => this.query<Site>(COLLECTIONS.sites, 'orgId', orgId),
    list: () => this.listAll<Site>(COLLECTIONS.sites),
    save: async (site: Site) => {
      await this.put(COLLECTIONS.sites, site);
    },
  };

  workers = {
    getById: (id: string) => this.getDoc<Worker>(COLLECTIONS.workers, id),
    getByPhone: async (phone: string) =>
      (await this.query<Worker>(COLLECTIONS.workers, 'phone', phone))[0] ?? null,
    listBySite: (siteId: string) => this.query<Worker>(COLLECTIONS.workers, 'siteId', siteId),
    listByOrg: (orgId: string) => this.query<Worker>(COLLECTIONS.workers, 'orgId', orgId),
    save: async (worker: Worker) => {
      await this.put(COLLECTIONS.workers, worker);
    },
  };

  admins = {
    getById: (id: string) => this.getDoc<Admin>(COLLECTIONS.admins, id),
    getByEmail: async (email: string) => {
      // Memory adapter matches case-insensitively; try the normalised form
      // first (how emails are stored), then the raw trimmed input.
      const lower = email.toLowerCase().trim();
      const hit = (await this.query<Admin>(COLLECTIONS.admins, 'email', lower))[0];
      if (hit) return hit;
      const raw = email.trim();
      if (raw === lower) return null;
      return (await this.query<Admin>(COLLECTIONS.admins, 'email', raw))[0] ?? null;
    },
    listByOrg: (orgId: string) => this.query<Admin>(COLLECTIONS.admins, 'orgId', orgId),
    save: async (admin: Admin) => {
      await this.put(COLLECTIONS.admins, admin);
    },
  };

  shifts = {
    create: (shift: Shift) => this.put(COLLECTIONS.shifts, shift),
    update: (shift: Shift) => this.put(COLLECTIONS.shifts, shift), // upsert, like memory
    getById: (id: string) => this.getDoc<Shift>(COLLECTIONS.shifts, id),
    getActiveForWorker: async (workerId: string) => {
      await this.ensureSeeded();
      const snap = await this.db
        .collection(COLLECTIONS.shifts)
        .where('workerId', '==', workerId)
        .where('checkOut', '==', null)
        .get();
      return snap.docs.length > 0 ? (snap.docs[0].data() as Shift) : null;
    },
    listByWorker: async (workerId: string) =>
      (await this.query<Shift>(COLLECTIONS.shifts, 'workerId', workerId)).sort(byCheckInDesc),
    listBySite: async (siteId: string) =>
      (await this.query<Shift>(COLLECTIONS.shifts, 'siteId', siteId)).sort(byCheckInDesc),
    listByOrg: async (orgId: string) =>
      (await this.query<Shift>(COLLECTIONS.shifts, 'orgId', orgId)).sort(byCheckInDesc),
  };

  hazards = {
    create: (hazard: HazardReport) => this.put(COLLECTIONS.hazards, hazard),
    update: (hazard: HazardReport) => this.put(COLLECTIONS.hazards, hazard),
    getById: async (id: string) => {
      const h = await this.getDoc<HazardReport>(COLLECTIONS.hazards, id);
      return h ? withLiveHazardStatus(h) : null;
    },
    listBySite: async (siteId: string) =>
      sortHazardsNewestFirst(
        (await this.query<HazardReport>(COLLECTIONS.hazards, 'siteId', siteId)).map(
          withLiveHazardStatus
        )
      ),
    listByOrg: async (orgId: string) =>
      sortHazardsNewestFirst(
        (await this.query<HazardReport>(COLLECTIONS.hazards, 'orgId', orgId)).map(
          withLiveHazardStatus
        )
      ),
  };

  feedback = {
    create: (item: FeedbackSubmission) => this.put(COLLECTIONS.feedback, item),
    listBySite: (siteId: string) =>
      this.query<FeedbackSubmission>(COLLECTIONS.feedback, 'siteId', siteId),
    listByOrg: (orgId: string) =>
      this.query<FeedbackSubmission>(COLLECTIONS.feedback, 'orgId', orgId),
    listBySiteAndWeek: async (siteId: string, isoWeek: string) =>
      (await this.query<FeedbackSubmission>(COLLECTIONS.feedback, 'siteId', siteId)).filter(
        (f) => f.isoWeek === isoWeek
      ),
  };

  skills = {
    create: (skill: SkillRecord) => this.put(COLLECTIONS.skills, skill),
    getById: (id: string) => this.getDoc<SkillRecord>(COLLECTIONS.skills, id),
    getByVerifyToken: async (token: string) =>
      (await this.query<SkillRecord>(COLLECTIONS.skills, 'verifyToken', token))[0] ?? null,
    listByWorker: (workerId: string) =>
      this.query<SkillRecord>(COLLECTIONS.skills, 'workerId', workerId),
  };
}

let firestoreInstance: FairShiftDatabase | null = null;

/**
 * Returns the Firestore-backed database. Throws a clear error if
 * initialisation fails — never silently falls back to memory.
 */
export function getFirestoreDb(): FairShiftDatabase {
  if (firestoreInstance) return firestoreInstance;
  const db = initFirestore();
  firestoreInstance = new FirestoreFairShiftDb(db);
  console.log('[FairShift Data] Backend in use: Cloud Firestore (ADC)');
  return firestoreInstance;
}

/** Test hook: drop the cached instance. */
export function resetFirestoreDbForTests(): void {
  firestoreInstance = null;
}
