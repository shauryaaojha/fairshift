/**
 * Data for each console page, plus the org-scoped hazard mutations, the public skill passport
 * and the gate kiosk. Each function takes a sector (already checked against the session) or an
 * explicit org id, and loads through adminService so a request reads each collection once.
 */

import QRCode from 'qrcode';
import { adminService, type PublicSite } from './adminService';
import { SECTORS } from './sectors';
import {
  buildHeatmapRows,
  filterHazards,
  filterRiskRows,
  toHazardRows,
  buildAttendanceRows,
} from './adminRows';
import type { HazardRow, HeatmapRow, RiskRow } from './adminRows';
import { generateSiteQrCode } from '../domain/qrCode';
import { computeHazardStatus } from '../domain/hazardSla';
import { getSkillStatus } from '../domain/skills';
import { istDateKey } from '../domain/time';
import {
  attendanceRegister,
  monthPeriod,
  toCsv,
  wageRegister,
  type RegisterKind,
} from '../domain/registers';
import { policyForDate } from '../domain/payRules';
import { getDatabase } from '../repos';
import { getSiteHeat } from '../weather';
import type { HeatReading } from '../domain/heat';
import { AppError } from '../../shared/errors';
import { SEVERITY_RANK } from '../../shared/severity';
import type {
  DailyAttendance,
  HazardReport,
  HazardSeverity,
  OverviewKPIs,
  Sector,
  Site,
} from '../../shared/types';

// ── Compositions used by pages ──────────────────────────────

export interface OverviewData {
  kpis: OverviewKPIs;
  trend: DailyAttendance[];
  escalated: HazardRow[];
  risk: RiskRow[];
  heatmap: HeatmapRow[];
  summary: { summary: string; isAi: boolean };
  /** Heat stress at the site now; null when the weather service is unavailable. */
  heat?: HeatReading | null;
}

export async function getOverviewData(sector: Sector): Promise<OverviewData> {
  const { orgId, siteId } = SECTORS[sector];
  const [kpis, trend, queue, risk, feedback, heat] = await Promise.all([
    adminService.getOverviewKPIs(orgId, siteId),
    adminService.getAttendanceTrend(orgId, siteId, 14),
    adminService.getSafetyQueue(orgId, siteId),
    adminService.getWorkforceRisk(orgId, siteId),
    adminService.getFeedbackHeatmap(orgId, siteId),
    getDatabase()
      .sites.get(siteId)
      .then((site) => (site ? getSiteHeat(site) : null)),
  ]);
  // The briefing reuses the KPIs above (live escalation count included) instead of recomputing.
  const summary = await adminService.getAiSummary(orgId, siteId, kpis);
  const escalated = toHazardRows(queue).filter((r) => r.liveStatus === 'escalated');
  return {
    kpis,
    trend,
    escalated,
    risk: risk.slice(0, 8),
    heatmap: buildHeatmapRows(feedback),
    summary,
    heat,
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

export async function getSitesData(
  allowed: Sector[],
): Promise<{ sector: Sector; sites: PublicSite[] }[]> {
  const out: { sector: Sector; sites: PublicSite[] }[] = [];
  for (const key of allowed) {
    out.push({ sector: key, sites: await adminService.getSites(SECTORS[key].orgId) });
  }
  return out;
}

// ── Mutations (org-scoped) ──────────────────────────────────

async function hazardInOrg(hazardId: string, orgId: string): Promise<HazardReport> {
  const hazard = await getDatabase().hazards.getById(hazardId);
  if (!hazard || hazard.orgId !== orgId) throw new AppError('not_found', 'Hazard not found');
  return hazard;
}

export async function acknowledgeHazardForOrg(
  hazardId: string,
  orgId: string,
): Promise<HazardReport> {
  await hazardInOrg(hazardId, orgId);
  return adminService.acknowledgeHazard(hazardId, [orgId]);
}

export async function resolveHazardForOrg(hazardId: string, orgId: string): Promise<HazardReport> {
  await hazardInOrg(hazardId, orgId);
  return adminService.resolveHazard(hazardId, [orgId]);
}

/** The admin confirms (or overrides) the severity; AI only suggests. */
export async function confirmHazardSeverity(
  hazardId: string,
  orgId: string,
  severity: HazardSeverity,
): Promise<HazardReport> {
  const hazard = await hazardInOrg(hazardId, orgId);
  const liveStatus = computeHazardStatus(hazard);
  if (liveStatus === 'escalated' && SEVERITY_RANK[severity] < SEVERITY_RANK[hazard.severity]) {
    throw new AppError('severity_locked', 'Cannot lower the severity of an escalated hazard');
  }
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

// ── Statutory registers ─────────────────────────────────────

export interface RegisterFile {
  filename: string;
  csv: string;
}

/**
 * The attendance or wage register for the sector's site and one month (`YYYY-MM`, default this
 * month), as CSV. A malformed or future month is a validation error.
 */
export async function getRegister(
  sector: Sector,
  kind: RegisterKind,
  month?: string,
  now: Date = new Date(),
): Promise<RegisterFile> {
  const wanted = month ?? istDateKey(now).slice(0, 7);
  const period = monthPeriod(wanted, now);
  if (!period) throw new AppError('validation', 'Pick this month or an earlier one');

  const { orgId, siteId } = SECTORS[sector];
  const db = getDatabase();
  const [workers, shifts, org] = await Promise.all([
    db.workers.listBySite(siteId),
    db.shifts.listBySite(siteId),
    db.orgs.get(orgId),
  ]);
  const build = kind === 'attendance' ? attendanceRegister : wageRegister;
  const rows = build(
    workers.filter((w) => w.active),
    shifts,
    period,
    policyForDate(org),
  );
  return { filename: `fairshift-${kind}-register-${siteId}-${wanted}.csv`, csv: toCsv(rows) };
}
