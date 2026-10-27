// Repositories: Interface Contracts

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

export interface OrgRepo {
  get(id: string): Promise<Org | null>;
  list(): Promise<Org[]>;
  save(org: Org): Promise<void>;
}

export interface SiteRepo {
  get(id: string): Promise<Site | null>;
  listByOrg(orgId: string): Promise<Site[]>;
  list(): Promise<Site[]>;
  save(site: Site): Promise<void>;
}

export interface WorkerRepo {
  getById(id: string): Promise<Worker | null>;
  getByPhone(phone: string): Promise<Worker | null>;
  listBySite(siteId: string): Promise<Worker[]>;
  listByOrg(orgId: string): Promise<Worker[]>;
  save(worker: Worker): Promise<void>;
}

export interface AdminRepo {
  getById(id: string): Promise<Admin | null>;
  getByEmail(email: string): Promise<Admin | null>;
  listByOrg(orgId: string): Promise<Admin[]>;
  save(admin: Admin): Promise<void>;
}

export interface ShiftRepo {
  create(shift: Shift): Promise<Shift>;
  update(shift: Shift): Promise<Shift>;
  getById(id: string): Promise<Shift | null>;
  getActiveForWorker(workerId: string): Promise<Shift | null>;
  listByWorker(workerId: string): Promise<Shift[]>;
  listBySite(siteId: string): Promise<Shift[]>;
  listByOrg(orgId: string): Promise<Shift[]>;
}

export interface HazardRepo {
  create(hazard: HazardReport): Promise<HazardReport>;
  update(hazard: HazardReport): Promise<HazardReport>;
  getById(id: string): Promise<HazardReport | null>;
  listBySite(siteId: string): Promise<HazardReport[]>;
  listByOrg(orgId: string): Promise<HazardReport[]>;
}

export interface FeedbackRepo {
  create(feedback: FeedbackSubmission): Promise<FeedbackSubmission>;
  listBySite(siteId: string): Promise<FeedbackSubmission[]>;
  listByOrg(orgId: string): Promise<FeedbackSubmission[]>;
  listBySiteAndWeek(siteId: string, isoWeek: string): Promise<FeedbackSubmission[]>;
}

export interface SkillRepo {
  create(skill: SkillRecord): Promise<SkillRecord>;
  getById(id: string): Promise<SkillRecord | null>;
  getByVerifyToken(token: string): Promise<SkillRecord | null>;
  listByWorker(workerId: string): Promise<SkillRecord[]>;
}

export interface FairShiftDatabase {
  orgs: OrgRepo;
  sites: SiteRepo;
  workers: WorkerRepo;
  admins: AdminRepo;
  shifts: ShiftRepo;
  hazards: HazardRepo;
  feedback: FeedbackRepo;
  skills: SkillRepo;
}
