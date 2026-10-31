/**
 * MongoDB store (Atlas or self-hosted). One pooled client per instance, indexes created on
 * first use, and the demo data seeded into an empty database.
 */

import { MongoClient, type Db, type Document } from 'mongodb';
import type { FairShiftDatabase } from './types';
import { serverEnv } from '../env';
import type {
  Org,
  Site,
  Worker,
  Admin,
  Shift,
  HazardReport,
  FeedbackSubmission,
  SkillRecord,
  PayQuery,
  WagePayment,
} from '../../shared/types';
import type { FeedbackBallot } from '../domain/feedbackBallot';
import { generateSeedData } from '../seed';
import { withLiveHazardStatus, sortHazardsNewestFirst } from './hazardStatus';

const COLLECTIONS = {
  orgs: 'orgs',
  sites: 'sites',
  workers: 'workers',
  admins: 'admins',
  shifts: 'shifts',
  hazards: 'hazards',
  feedback: 'feedback',
  feedbackBallots: 'feedbackBallots',
  skills: 'skills',
  payQueries: 'payQueries',
  wagePayments: 'wagePayments',
} as const;

/** Never return Mongo's internal _id to callers. */
const NO_ID = { projection: { _id: 0 } } as const;

/** Indexes for every lookup the repos make (all single-field). */
const INDEXES: Record<string, string[]> = {
  orgs: ['id'],
  sites: ['id', 'orgId'],
  workers: ['id', 'phone', 'siteId', 'orgId'],
  admins: ['id', 'email', 'orgId'],
  shifts: ['id', 'workerId', 'siteId', 'orgId'],
  hazards: ['id', 'siteId', 'orgId'],
  feedback: ['id', 'siteId', 'orgId'],
  skills: ['id', 'workerId', 'verifyToken'],
  payQueries: ['id', 'workerId', 'orgId'],
  wagePayments: ['id', 'workerId', 'siteId'],
};

function byCheckInDesc(a: Shift, b: Shift): number {
  return new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime();
}

function byRaisedDesc(a: PayQuery, b: PayQuery): number {
  return Date.parse(b.raisedAt) - Date.parse(a.raisedAt);
}

type GlobalWithMongo = typeof globalThis & { __fairshiftMongo?: Promise<MongoClient> };

function connect(uri: string): Promise<MongoClient> {
  const g = globalThis as GlobalWithMongo;
  if (!g.__fairshiftMongo) {
    g.__fairshiftMongo = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 })
      .connect()
      .catch((err) => {
        g.__fairshiftMongo = undefined;
        throw err;
      });
  }
  return g.__fairshiftMongo;
}

/** Seeds the database from the demo seed if `orgs` is empty. Returns true when it wrote data. */
export async function seedMongoIfEmpty(db: Db): Promise<boolean> {
  for (const [col, fields] of Object.entries(INDEXES)) {
    await Promise.all(
      fields.map((field) =>
        db.collection(col).createIndex({ [field]: 1 }, { unique: field === 'id' }),
      ),
    );
  }
  if ((await db.collection(COLLECTIONS.orgs).countDocuments({}, { limit: 1 })) > 0) return false;

  const data = await generateSeedData();
  for (const key of Object.keys(COLLECTIONS) as Array<keyof typeof COLLECTIONS>) {
    const items = data[key] as Document[];
    if (items.length > 0) {
      await db.collection(COLLECTIONS[key]).insertMany(items.map((i) => ({ ...i })));
    }
  }
  return true;
}

class MongoFairShiftDb implements FairShiftDatabase {
  private seedPromise: Promise<void> | null = null;

  constructor(private readonly getDb: () => Promise<Db>) {}

  /** Seeds once per instance (cached promise); retried if it failed. */
  private ensureSeeded(): Promise<void> {
    if (!this.seedPromise) {
      this.seedPromise = this.getDb()
        .then((db) => seedMongoIfEmpty(db))
        .then((seeded) => {
          if (seeded) console.info('[FairShift Data] Seeded empty MongoDB database');
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
    return (await this.getDb()).collection(col).findOne({ id }, NO_ID) as Promise<T | null>;
  }

  private async query<T>(col: string, field: string, value: unknown): Promise<T[]> {
    await this.ensureSeeded();
    return (await this.getDb())
      .collection(col)
      .find({ [field]: value }, NO_ID)
      .toArray() as Promise<T[]>;
  }

  private async put<T extends { id: string }>(col: string, item: T): Promise<T> {
    await this.ensureSeeded();
    await (
      await this.getDb()
    )
      .collection(col)
      .replaceOne({ id: item.id }, { ...item }, { upsert: true });
    return item;
  }

  private async listAll<T>(col: string): Promise<T[]> {
    await this.ensureSeeded();
    return (await this.getDb()).collection(col).find({}, NO_ID).toArray() as Promise<T[]>;
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
      return (await this.getDb())
        .collection(COLLECTIONS.shifts)
        .findOne({ workerId, checkOut: null }, NO_ID) as Promise<Shift | null>;
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
          withLiveHazardStatus,
        ),
      ),
    listByOrg: async (orgId: string) =>
      sortHazardsNewestFirst(
        (await this.query<HazardReport>(COLLECTIONS.hazards, 'orgId', orgId)).map(
          withLiveHazardStatus,
        ),
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
        (f) => f.isoWeek === isoWeek,
      ),
  };

  /**
   * The ballot id is used as Mongo's _id, so the unique _id index makes the claim atomic and no
   * ObjectId (which embeds a timestamp) can line a ballot up with the answer stored beside it.
   */
  feedbackBallots = {
    claim: async (ballot: FeedbackBallot) => {
      await this.ensureSeeded();
      try {
        await (
          await this.getDb()
        )
          .collection<Document>(COLLECTIONS.feedbackBallots)
          .insertOne({ _id: ballot.id as unknown as Document['_id'], ...ballot });
        return true;
      } catch (err) {
        if ((err as { code?: number }).code === 11000) return false;
        throw err;
      }
    },
    has: async (id: string) =>
      (await this.getDoc<FeedbackBallot>(COLLECTIONS.feedbackBallots, id)) !== null,
  };

  skills = {
    create: (skill: SkillRecord) => this.put(COLLECTIONS.skills, skill),
    getById: (id: string) => this.getDoc<SkillRecord>(COLLECTIONS.skills, id),
    getByVerifyToken: async (token: string) =>
      (await this.query<SkillRecord>(COLLECTIONS.skills, 'verifyToken', token))[0] ?? null,
    listByWorker: (workerId: string) =>
      this.query<SkillRecord>(COLLECTIONS.skills, 'workerId', workerId),
  };

  payQueries = {
    create: (query: PayQuery) => this.put(COLLECTIONS.payQueries, query),
    update: (query: PayQuery) => this.put(COLLECTIONS.payQueries, query),
    getById: (id: string) => this.getDoc<PayQuery>(COLLECTIONS.payQueries, id),
    listByWorker: async (workerId: string) =>
      (await this.query<PayQuery>(COLLECTIONS.payQueries, 'workerId', workerId)).sort(byRaisedDesc),
    listByOrg: async (orgId: string) =>
      (await this.query<PayQuery>(COLLECTIONS.payQueries, 'orgId', orgId)).sort(byRaisedDesc),
  };

  /** The unique index on `id` (one per worker and month) makes a second payment fail atomically. */
  wagePayments = {
    record: async (payment: WagePayment) => {
      await this.ensureSeeded();
      try {
        await (await this.getDb()).collection(COLLECTIONS.wagePayments).insertOne({ ...payment });
        return true;
      } catch (err) {
        if ((err as { code?: number }).code === 11000) return false;
        throw err;
      }
    },
    get: async (workerId: string, period: string) => {
      await this.ensureSeeded();
      return (await (
        await this.getDb()
      )
        .collection(COLLECTIONS.wagePayments)
        .findOne({ workerId, period }, NO_ID)) as WagePayment | null;
    },
    listBySite: (siteId: string) =>
      this.query<WagePayment>(COLLECTIONS.wagePayments, 'siteId', siteId),
  };
}

/** Connects and pings, so callers can tell a reachable cluster from a blocked one. */
export async function pingMongo(): Promise<void> {
  const { mongoUri, mongoDb } = serverEnv();
  if (!mongoUri) throw new Error('MONGODB_URI is not set');
  const client = await connect(mongoUri);
  await client.db(mongoDb).command({ ping: 1 });
}

let mongoInstance: FairShiftDatabase | null = null;

/**
 * Returns the MongoDB-backed database. Requires MONGODB_URI; throws a clear
 * error instead of silently falling back to memory.
 */
export function getMongoDb(): FairShiftDatabase {
  if (mongoInstance) return mongoInstance;
  const { mongoUri, mongoDb } = serverEnv();
  if (!mongoUri) throw new Error('[FairShift Data] MONGODB_URI is not set.');
  mongoInstance = new MongoFairShiftDb(async () => (await connect(mongoUri)).db(mongoDb));
  console.info('[FairShift Data] Backend in use: MongoDB');
  return mongoInstance;
}
