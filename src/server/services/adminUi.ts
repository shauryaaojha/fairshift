// ============================================================
// FairShift - Admin UI compositions
// Thin, testable layer between the admin pages and adminService/repos.
// Pure helpers (sector config, state sentence, heatmap, filters) are
// exported separately so they can be unit tested without a database.
// ============================================================

import QRCode from 'qrcode';
import { adminService, type PublicSite, type PublicWorker } from './adminService';
import { generateSiteQrCode } from '../domain/qrCode';
import { getDatabase } from '../repos';
import { computeHazardStatus, getRemainingSlaSeconds, formatSlaRemaining } from '../domain/hazardSla';
import { getSkillStatus } from '../domain/skills';
import { istDateKey } from '../domain/time';
import type {
  AggregatedFeedback,
  DailyAttendance,
  HazardReport,
  HazardSeverity,
  HazardStatus,
  OverviewKPIs,
  QuitRiskResult,
  Sector,
  Shift,
  Site,
  Worker,
} from '../../shared/types';

// ── Sector configuration ────────────────────────────────────

export interface SectorConfig {
  key: Sector;
  orgId: string;
  siteId: string;
  label: string;
  place: string;
}

export const SECTORS: Record<Sector, SectorConfig> = {
  construction: {
    key: 'construction',
    orgId: 'org-construction',
    siteId: 'site-skyline-chennai',
    label: 'Construction',
    place: 'Skyline Towers',
  },
  college: {
    key: 'college',
    orgId: 'org-college',
    siteId: 'site-srm-campus',
    label: 'College',
    place: 'Campus Facilities',
  },
};

export const SECTOR_COOKIE_NAME = 'fairshift_sector';

export function resolveSector(value: string | null | undefined): Sector {
  return value === 'college' ? 'college' : 'construction';
}

export function sectorForOrg(orgId: string): Sector {
  return orgId === SECTORS.college.orgId ? 'college' : 'construction';
}

// ── State sentence ──────────────────────────────────────────

export interface SentenceSegment {
  text: string;
  /** Present when the segment is a number that links to its rows */
  href?: string;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * "43 of 51 on site . 2 hazards escalated . 5 workers flagged for fatigue".
 * Each count is a link to the rows behind it.
 */
export function buildStateSegments(
  kpis: Pick<OverviewKPIs, 'onSiteNow' | 'totalWorkers' | 'escalatedHazards' | 'fatigueFlags'>,
): SentenceSegment[] {
  return [
    { text: `${kpis.onSiteNow} of ${kpis.totalWorkers}`, href: '/admin/attendance?status=on-site' },
    { text: ' on site · ' },
    {
      text: `${kpis.escalatedHazards} ${plural(kpis.escalatedHazards, 'hazard', 'hazards')}`,
      href: '/admin/safety?status=escalated',
    },
    { text: ' escalated · ' },
    {
      text: `${kpis.fatigueFlags} ${plural(kpis.fatigueFlags, 'worker', 'workers')}`,
      href: '/admin/risk?filter=fatigue',
    },
    { text: ' flagged for fatigue' },
  ];
}

// ── Feedback heatmap ────────────────────────────────────────

export const FEEDBACK_QUESTIONS = [
  { key: 'managerRespect', label: 'Manager respect' },
  { key: 'safetyRating', label: 'Safety' },
  { key: 'payFairness', label: 'Pay fairness' },
  { key: 'workloadRating', label: 'Workload' },
] as const;

export type FeedbackQuestionKey = (typeof FEEDBACK_QUESTIONS)[number]['key'];

export interface HeatmapCell {
  key: FeedbackQuestionKey;
  label: string;
  /** null = hidden because fewer than k people answered */
  value: number | null;
}

export interface HeatmapRow {
  team: string;
  count: number;
  hidden: boolean;
  cells: HeatmapCell[];
}

/**
 * Team x question grid. A team with fewer than k answers (or whose averages
 * the backend already suppressed) has every cell hidden: no numbers leave
 * this function for small groups.
 */
export function buildHeatmapRows(feedback: AggregatedFeedback[], k = 3): HeatmapRow[] {
  return [...feedback]
    .sort((a, b) => a.team.localeCompare(b.team))
    .map((f) => {
      const hidden = f.count < k || f.averages === null;
      return {
        team: f.team,
        count: f.count,
        hidden,
        cells: FEEDBACK_QUESTIONS.map((q) => ({
          key: q.key,
          label: q.label,
          value: hidden || !f.averages ? null : f.averages[q.key],
        })),
      };
    });
}

// ── Hazards ─────────────────────────────────────────────────

export interface HazardRow extends HazardReport {
  liveStatus: HazardStatus;
  remainingSeconds: number;
  slaLabel: string;
}

const STATUS_ORDER: Record<HazardStatus, number> = {
  escalated: 0,
  reported: 1,
  acknowledged: 2,
  resolved: 3,
};

/** Adds live (computed-on-read) status and SLA text, most urgent first. */
export function toHazardRows(hazards: HazardReport[], now: Date = new Date()): HazardRow[] {
  return hazards
    .map((h) => {
      const liveStatus = computeHazardStatus(h, now);
      const remainingSeconds = getRemainingSlaSeconds(h, now);
      const slaLabel =
        liveStatus === 'resolved'
          ? 'Resolved'
          : h.acknowledgedAt
            ? 'Acknowledged'
            : formatSlaRemaining(remainingSeconds);
      return { ...h, liveStatus, remainingSeconds, slaLabel };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.liveStatus] - STATUS_ORDER[b.liveStatus] ||
        a.remainingSeconds - b.remainingSeconds,
    );
}

export function filterHazards(rows: HazardRow[], status: string | undefined): HazardRow[] {
  if (!status || status === 'all') return rows;
  if (status === 'open') return rows.filter((r) => r.liveStatus !== 'resolved');
  return rows.filter((r) => r.liveStatus === status);
}

// ── Attendance rows ─────────────────────────────────────────

export interface AttendanceRow {
  shiftId: string;
  workerName: string;
  team: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
  hours: number | null;
  method: Shift['method'];
  onSite: boolean;
}

export function buildAttendanceRows(
  shifts: Shift[],
  workers: Worker[],
  opts: { status?: string; team?: string; days?: number; today?: string } = {},
): AttendanceRow[] {
  const byId = new Map(workers.map((w) => [w.id, w]));
  const days = opts.days ?? 14;
  const latest = shifts.reduce((m, s) => (s.checkIn > m ? s.checkIn : m), '');
  const anchor = new Date(opts.today ?? (latest || new Date().toISOString())).getTime();
  const cutoff = anchor - days * 24 * 3600 * 1000;

  return shifts
    .filter((s) => new Date(s.checkIn).getTime() >= cutoff)
    .map((s): AttendanceRow | null => {
      const w = byId.get(s.workerId);
      if (!w) return null;
      const hours = s.checkOut
        ? Math.round(((new Date(s.checkOut).getTime() - new Date(s.checkIn).getTime()) / 3600000) * 10) / 10
        : null;
      return {
        shiftId: s.id,
        workerName: w.name,
        team: w.team,
        date: istDateKey(s.checkIn),
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        hours,
        method: s.method,
        onSite: s.checkOut === null,
      };
    })
    .filter((r): r is AttendanceRow => r !== null)
    .filter((r) => (opts.status === 'on-site' ? r.onSite : opts.status === 'over-8' ? (r.hours ?? 0) > 8 : true))
    .filter((r) => !opts.team || opts.team === 'all' || r.team === opts.team)
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn) || a.workerName.localeCompare(b.workerName));
}

// ── Risk rows ───────────────────────────────────────────────

export type RiskRow = PublicWorker & { risk: QuitRiskResult };

export function filterRiskRows(rows: RiskRow[], filter: string | undefined, team?: string): RiskRow[] {
  let out = rows;
  if (filter === 'high') out = out.filter((r) => r.risk.score > 50);
  if (filter === 'fatigue') out = out.filter((r) => r.risk.topReasons.some((t) => t.factor === 'fatigue_flags' || t.factor === 'ot_load'));
  if (team && team !== 'all') out = out.filter((r) => r.team === team);
  return out;
}

// ── Compositions used by pages ──────────────────────────────

export interface OverviewData {
  kpis: OverviewKPIs;
  trend: DailyAttendance[];
  escalated: HazardRow[];
  risk: RiskRow[];
  heatmap: HeatmapRow[];
  summary: { summary: string; isAi: boolean };
}

export async function getOverviewData(sector: Sector): Promise<OverviewData> {
  const { orgId, siteId } = SECTORS[sector];
  const [kpis, trend, queue, risk, feedback, summary] = await Promise.all([
    adminService.getOverviewKPIs(orgId, siteId),
    adminService.getAttendanceTrend(orgId, siteId, 14),
    adminService.getSafetyQueue(orgId, siteId),
    adminService.getWorkforceRisk(orgId, siteId),
    adminService.getFeedbackHeatmap(orgId, siteId),
    adminService.getAiSummary(orgId, siteId),
  ]);
  const rows = toHazardRows(queue);
  const escalated = rows.filter((r) => r.liveStatus === 'escalated');
  return {
    // Escalation is computed on read, so the headline count uses the live status.
    kpis: { ...kpis, escalatedHazards: escalated.length },
    trend,
    escalated,
    risk: risk.slice(0, 8),
    heatmap: buildHeatmapRows(feedback),
    summary,
  };
}

export async function getSafetyData(sector: Sector, status?: string) {
  const { orgId, siteId } = SECTORS[sector];
  const queue = await adminService.getSafetyQueue(orgId, siteId);
  const all = toHazardRows(queue);
  return { rows: filterHazards(all, status), total: all.length };
}

export async function getAttendanceData(sector: Sector, opts: { status?: string; team?: string }) {
  const { orgId, siteId } = SECTORS[sector];
  const db = getDatabase();
  const [shifts, workers, trend] = await Promise.all([
    db.shifts.listBySite(siteId),
    db.workers.listBySite(siteId),
    adminService.getAttendanceTrend(orgId, siteId, 14),
  ]);
  const teams = Array.from(new Set(workers.map((w) => w.team))).sort();
  return { rows: buildAttendanceRows(shifts, workers, opts), teams, trend };
}

export async function getFeedbackData(sector: Sector) {
  const { orgId, siteId } = SECTORS[sector];
  const agg = await adminService.getFeedbackHeatmap(orgId, siteId);
  return {
    heatmap: buildHeatmapRows(agg),
    // Comments only exist for teams that cleared the k threshold.
    comments: agg
      .filter((a) => a.count >= 3 && a.comments)
      .map((a) => ({ team: a.team, comments: a.comments as string[] })),
  };
}

export async function getRiskData(sector: Sector, opts: { filter?: string; team?: string }) {
  const { orgId, siteId } = SECTORS[sector];
  const all = await adminService.getWorkforceRisk(orgId, siteId);
  const teams = Array.from(new Set(all.map((w) => w.team))).sort();
  return { rows: filterRiskRows(all, opts.filter, opts.team), teams };
}

export async function getSitesData(allowed: Sector[]): Promise<{ sector: Sector; sites: PublicSite[] }[]> {
  const out: { sector: Sector; sites: PublicSite[] }[] = [];
  for (const key of allowed) {
    out.push({ sector: key, sites: await adminService.getSites(SECTORS[key].orgId) });
  }
  return out;
}

// ── Mutations (org-scoped) ──────────────────────────────────

async function hazardInOrg(hazardId: string, orgId: string): Promise<HazardReport> {
  const hazard = await getDatabase().hazards.getById(hazardId);
  if (!hazard || hazard.orgId !== orgId) throw new Error('Hazard not found');
  return hazard;
}

export async function acknowledgeHazardForOrg(hazardId: string, orgId: string): Promise<HazardReport> {
  await hazardInOrg(hazardId, orgId);
  return adminService.acknowledgeHazard(hazardId, [orgId]);
}

export async function resolveHazardForOrg(hazardId: string, orgId: string): Promise<HazardReport> {
  await hazardInOrg(hazardId, orgId);
  return adminService.resolveHazard(hazardId, [orgId]);
}

const SEVERITIES: HazardSeverity[] = ['critical', 'high', 'medium', 'low'];

export function isSeverity(value: unknown): value is HazardSeverity {
  return typeof value === 'string' && (SEVERITIES as string[]).includes(value);
}

/** The admin confirms (or overrides) the severity; AI only suggests. */
export async function confirmHazardSeverity(
  hazardId: string,
  orgId: string,
  severity: HazardSeverity,
): Promise<HazardReport> {
  const hazard = await hazardInOrg(hazardId, orgId);
  return getDatabase().hazards.update({ ...hazard, severity });
}

// ── Public skill passport ───────────────────────────────────

export interface PassportView {
  title: string;
  issuer: string;
  issuedDate: string;
  expiryDate: string | null;
  holder: string;
  verified: boolean;
  status: ReturnType<typeof getSkillStatus>;
}

/** Public verify page: first name only, never phone or pay. */
export async function getPassportByToken(token: string): Promise<PassportView | null> {
  if (!/^[a-f0-9]{8,64}$/i.test(token)) return null;
  const db = getDatabase();
  const skill = await db.skills.getByVerifyToken(token);
  if (!skill) return null;
  const worker = await db.workers.getById(skill.workerId);
  return {
    title: skill.title,
    issuer: skill.issuer,
    issuedDate: skill.issuedDate,
    expiryDate: skill.expiryDate,
    holder: worker ? worker.name.split(' ')[0] : 'Worker',
    verified: skill.verified,
    status: getSkillStatus(skill),
  };
}

// ── Gate kiosk ──────────────────────────────────────────────

export interface KioskView {
  site: Site;
  code: string;
  validUntil: number;
  qrSvg: string;
  url: string;
}

/**
 * Kiosk QR with an ABSOLUTE check-in URL, so a phone camera can open it
 * (adminService.getKioskData returns a relative path, which cameras cannot use).
 */
export async function getKioskView(
  siteId: string,
  origin: string,
  allowedOrgIds: string[],
): Promise<KioskView | null> {
  const site = await adminService.getSiteById(siteId);
  if (!site || !allowedOrgIds.includes(site.orgId)) return null;
  const { code, validUntil } = generateSiteQrCode(site.qrSecret);
  const url = `${origin}/w/checkin?site=${encodeURIComponent(site.id)}&code=${code}`;
  const qrSvg = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#1C1D1A', light: '#FFFFFF' },
  });
  return { site, code, validUntil, qrSvg, url };
}
