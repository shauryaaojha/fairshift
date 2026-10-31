/**
 * In-memory store seeded with the demo data. Used when MONGODB_URI is unset, in tests, and as the
 * fallback when MongoDB is unreachable. Resets when the server instance restarts.
 */

import type {
  FairShiftDatabase,
  OrgRepo,
  SiteRepo,
  WorkerRepo,
  AdminRepo,
  ShiftRepo,
  HazardRepo,
  FeedbackRepo,
  FeedbackBallotRepo,
  SkillRepo,
  PayQueryRepo,
  WagePaymentRepo,
} from './types';
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

class InMemoryFairShiftDb implements FairShiftDatabase {
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private orgsMap = new Map<string, Org>();
  private sitesMap = new Map<string, Site>();
  private workersMap = new Map<string, Worker>();
  private adminsMap = new Map<string, Admin>();
  private shiftsList: Shift[] = [];
  private hazardsList: HazardReport[] = [];
  private feedbackList: FeedbackSubmission[] = [];
  private ballotIds = new Set<string>();
  private skillsList: SkillRecord[] = [];
  private payQueriesList: PayQuery[] = [];
  private wagePaymentsMap = new Map<string, WagePayment>();

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const data = await generateSeedData();
      for (const org of data.orgs) this.orgsMap.set(org.id, org);
      for (const site of data.sites) this.sitesMap.set(site.id, site);
      for (const worker of data.workers) this.workersMap.set(worker.id, worker);
      for (const admin of data.admins) this.adminsMap.set(admin.id, admin);
      this.shiftsList = [...data.shifts];
      this.hazardsList = [...data.hazards];
      this.feedbackList = [...data.feedback];
      this.skillsList = [...data.skills];
      this.payQueriesList = [...data.payQueries];
      for (const p of data.wagePayments) this.wagePaymentsMap.set(p.id, p);
      this.initialized = true;
    })();

    return this.initPromise;
  }

  // ── Org Repo ────────────────────────────────────────────────
  orgs: OrgRepo = {
    get: async (id: string) => {
      await this.ensureInitialized();
      return this.orgsMap.get(id) ?? null;
    },
    list: async () => {
      await this.ensureInitialized();
      return Array.from(this.orgsMap.values());
    },
    save: async (org: Org) => {
      await this.ensureInitialized();
      this.orgsMap.set(org.id, org);
    },
  };

  // ── Site Repo ───────────────────────────────────────────────
  sites: SiteRepo = {
    get: async (id: string) => {
      await this.ensureInitialized();
      return this.sitesMap.get(id) ?? null;
    },
    listByOrg: async (orgId: string) => {
      await this.ensureInitialized();
      return Array.from(this.sitesMap.values()).filter((s) => s.orgId === orgId);
    },
    list: async () => {
      await this.ensureInitialized();
      return Array.from(this.sitesMap.values());
    },
    save: async (site: Site) => {
      await this.ensureInitialized();
      this.sitesMap.set(site.id, site);
    },
  };

  // ── Worker Repo ─────────────────────────────────────────────
  workers: WorkerRepo = {
    getById: async (id: string) => {
      await this.ensureInitialized();
      return this.workersMap.get(id) ?? null;
    },
    getByPhone: async (phone: string) => {
      await this.ensureInitialized();
      for (const worker of this.workersMap.values()) {
        if (worker.phone === phone) return worker;
      }
      return null;
    },
    listBySite: async (siteId: string) => {
      await this.ensureInitialized();
      return Array.from(this.workersMap.values()).filter((w) => w.siteId === siteId);
    },
    listByOrg: async (orgId: string) => {
      await this.ensureInitialized();
      return Array.from(this.workersMap.values()).filter((w) => w.orgId === orgId);
    },
    save: async (worker: Worker) => {
      await this.ensureInitialized();
      this.workersMap.set(worker.id, worker);
    },
  };

  // ── Admin Repo ──────────────────────────────────────────────
  admins: AdminRepo = {
    getById: async (id: string) => {
      await this.ensureInitialized();
      return this.adminsMap.get(id) ?? null;
    },
    getByEmail: async (email: string) => {
      await this.ensureInitialized();
      const lower = email.toLowerCase().trim();
      for (const admin of this.adminsMap.values()) {
        if (admin.email.toLowerCase().trim() === lower) return admin;
      }
      return null;
    },
    listByOrg: async (orgId: string) => {
      await this.ensureInitialized();
      return Array.from(this.adminsMap.values()).filter((a) => a.orgId === orgId);
    },
    save: async (admin: Admin) => {
      await this.ensureInitialized();
      this.adminsMap.set(admin.id, admin);
    },
  };

  // ── Shift Repo ──────────────────────────────────────────────
  shifts: ShiftRepo = {
    create: async (shift: Shift) => {
      await this.ensureInitialized();
      this.shiftsList.push(shift);
      return shift;
    },
    update: async (shift: Shift) => {
      await this.ensureInitialized();
      const idx = this.shiftsList.findIndex((s) => s.id === shift.id);
      if (idx !== -1) {
        this.shiftsList[idx] = shift;
      } else {
        this.shiftsList.push(shift);
      }
      return shift;
    },
    getById: async (id: string) => {
      await this.ensureInitialized();
      return this.shiftsList.find((s) => s.id === id) ?? null;
    },
    getActiveForWorker: async (workerId: string) => {
      await this.ensureInitialized();
      return this.shiftsList.find((s) => s.workerId === workerId && s.checkOut === null) ?? null;
    },
    listByWorker: async (workerId: string) => {
      await this.ensureInitialized();
      return this.shiftsList
        .filter((s) => s.workerId === workerId)
        .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime());
    },
    listBySite: async (siteId: string) => {
      await this.ensureInitialized();
      return this.shiftsList
        .filter((s) => s.siteId === siteId)
        .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime());
    },
    listByOrg: async (orgId: string) => {
      await this.ensureInitialized();
      return this.shiftsList
        .filter((s) => s.orgId === orgId)
        .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime());
    },
  };

  // ── Hazard Repo ─────────────────────────────────────────────
  hazards: HazardRepo = {
    create: async (hazard: HazardReport) => {
      await this.ensureInitialized();
      this.hazardsList.unshift(hazard);
      return hazard;
    },
    update: async (hazard: HazardReport) => {
      await this.ensureInitialized();
      const idx = this.hazardsList.findIndex((h) => h.id === hazard.id);
      if (idx !== -1) {
        this.hazardsList[idx] = hazard;
      } else {
        this.hazardsList.unshift(hazard);
      }
      return hazard;
    },
    getById: async (id: string) => {
      await this.ensureInitialized();
      const h = this.hazardsList.find((hazard) => hazard.id === id);
      if (!h) return null;
      // Compute live status on read
      return withLiveHazardStatus(h);
    },
    listBySite: async (siteId: string) => {
      await this.ensureInitialized();
      return sortHazardsNewestFirst(
        this.hazardsList.filter((h) => h.siteId === siteId).map(withLiveHazardStatus),
      );
    },
    listByOrg: async (orgId: string) => {
      await this.ensureInitialized();
      return sortHazardsNewestFirst(
        this.hazardsList.filter((h) => h.orgId === orgId).map(withLiveHazardStatus),
      );
    },
  };

  // ── Feedback Repo ───────────────────────────────────────────
  feedback: FeedbackRepo = {
    create: async (item: FeedbackSubmission) => {
      await this.ensureInitialized();
      this.feedbackList.unshift(item);
      return item;
    },
    listBySite: async (siteId: string) => {
      await this.ensureInitialized();
      return this.feedbackList.filter((f) => f.siteId === siteId);
    },
    listByOrg: async (orgId: string) => {
      await this.ensureInitialized();
      return this.feedbackList.filter((f) => f.orgId === orgId);
    },
    listBySiteAndWeek: async (siteId: string, isoWeek: string) => {
      await this.ensureInitialized();
      return this.feedbackList.filter((f) => f.siteId === siteId && f.isoWeek === isoWeek);
    },
  };

  // ── Feedback ballots ────────────────────────────────────────
  feedbackBallots: FeedbackBallotRepo = {
    claim: async (ballot: FeedbackBallot) => {
      await this.ensureInitialized();
      if (this.ballotIds.has(ballot.id)) return false;
      this.ballotIds.add(ballot.id);
      return true;
    },
    has: async (id: string) => {
      await this.ensureInitialized();
      return this.ballotIds.has(id);
    },
  };

  // ── Skill Repo ──────────────────────────────────────────────
  skills: SkillRepo = {
    create: async (skill: SkillRecord) => {
      await this.ensureInitialized();
      this.skillsList.unshift(skill);
      return skill;
    },
    getById: async (id: string) => {
      await this.ensureInitialized();
      return this.skillsList.find((s) => s.id === id) ?? null;
    },
    getByVerifyToken: async (token: string) => {
      await this.ensureInitialized();
      return this.skillsList.find((s) => s.verifyToken === token) ?? null;
    },
    listByWorker: async (workerId: string) => {
      await this.ensureInitialized();
      return this.skillsList.filter((s) => s.workerId === workerId);
    },
  };

  // ── Pay Query Repo ──────────────────────────────────────────
  payQueries: PayQueryRepo = {
    create: async (query: PayQuery) => {
      await this.ensureInitialized();
      this.payQueriesList.unshift(query);
      return query;
    },
    update: async (query: PayQuery) => {
      await this.ensureInitialized();
      const idx = this.payQueriesList.findIndex((q) => q.id === query.id);
      if (idx !== -1) this.payQueriesList[idx] = query;
      else this.payQueriesList.unshift(query);
      return query;
    },
    getById: async (id: string) => {
      await this.ensureInitialized();
      return this.payQueriesList.find((q) => q.id === id) ?? null;
    },
    listByWorker: async (workerId: string) => {
      await this.ensureInitialized();
      return newestFirst(this.payQueriesList.filter((q) => q.workerId === workerId));
    },
    listByOrg: async (orgId: string) => {
      await this.ensureInitialized();
      return newestFirst(this.payQueriesList.filter((q) => q.orgId === orgId));
    },
  };

  // ── Wage payments ───────────────────────────────────────────
  wagePayments: WagePaymentRepo = {
    record: async (payment: WagePayment) => {
      await this.ensureInitialized();
      if (this.wagePaymentsMap.has(payment.id)) return false;
      this.wagePaymentsMap.set(payment.id, payment);
      return true;
    },
    get: async (workerId: string, period: string) => {
      await this.ensureInitialized();
      return (
        [...this.wagePaymentsMap.values()].find(
          (p) => p.workerId === workerId && p.period === period,
        ) ?? null
      );
    },
    listBySite: async (siteId: string) => {
      await this.ensureInitialized();
      return [...this.wagePaymentsMap.values()].filter((p) => p.siteId === siteId);
    },
  };
}

function newestFirst(queries: PayQuery[]): PayQuery[] {
  return [...queries].sort((a, b) => Date.parse(b.raisedAt) - Date.parse(a.raisedAt));
}

export const inMemoryDb = new InMemoryFairShiftDb();
