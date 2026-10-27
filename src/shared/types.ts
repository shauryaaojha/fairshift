// ============================================================
// FairShift — Shared Types
// All domain, service, and UI layers import from here.
// ============================================================

// ── Locale ──────────────────────────────────────────────────
export type Locale = 'en' | 'hi' | 'ta';

// ── Organisation & Site ─────────────────────────────────────
export type Sector = 'construction' | 'college';

export interface Org {
  id: string;
  name: string;
  sector: Sector;
  /** Per-org policy overrides */
  policy?: OrgPolicy;
}

export interface OrgPolicy {
  dailyHoursLimit?: number;    // default 8
  weeklyHoursLimit?: number;   // default 48
  otMultiplier?: number;       // default 2
  pfRate?: number;             // default 0.12
  pfCeiling?: number;          // default 15000
  esiRate?: number;            // default 0.0075
  esiCeiling?: number;         // default 21000
  anonymityK?: number;         // default 3
}

export interface Site {
  id: string;
  orgId: string;
  name: string;
  lat: number;
  lng: number;
  radiusMetres: number;
  /** TOTP secret for rotating QR (hex string, from env/seed) */
  qrSecret: string;
}

// ── Worker ──────────────────────────────────────────────────
export type PayType = 'daily' | 'monthly';
export type WorkerRole = 'mason' | 'helper' | 'electrician' | 'housekeeping' | 'security' | 'maintenance' | 'plumber';

export interface Worker {
  id: string;
  orgId: string;
  siteId: string;
  name: string;
  phone: string;
  /** scrypt hash of 4-digit PIN */
  pinHash: string;
  role: WorkerRole;
  payType: PayType;
  /** Daily wage or monthly salary in ₹ */
  basePay: number;
  /** Allowances per period in ₹ */
  allowances: number;
  team: string;
  locale: Locale;
  active: boolean;
}

// ── Admin ───────────────────────────────────────────────────
export interface Admin {
  id: string;
  /** Home organisation. */
  orgId: string;
  /** Organisations this admin may view and act on. Defaults to [orgId]. */
  orgIds?: string[];
  name: string;
  email: string;
  /** scrypt hash of password */
  passwordHash: string;
}

// ── Session ─────────────────────────────────────────────────
export type SessionRole = 'worker' | 'admin';

export interface SessionPayload {
  userId: string;
  orgId: string;
  /** Admins only: every organisation the session may access (signed, so trusted). */
  orgIds?: string[];
  role: SessionRole;
  iat: number;
  exp: number;
}

// ── Shift / Attendance ──────────────────────────────────────
export interface Shift {
  id: string;
  workerId: string;
  siteId: string;
  orgId: string;
  /** ISO datetime */
  checkIn: string;
  /** ISO datetime, null if still on site */
  checkOut: string | null;
  /** 'qr' | 'gps' | 'manual' */
  method: 'qr' | 'gps' | 'manual';
}

// ── Overtime ────────────────────────────────────────────────
export interface OvertimeResult {
  regularHours: number;
  overtimeHours: number;
  /** In ₹ */
  regularPay: number;
  /** In ₹ */
  overtimePay: number;
}

export interface DailyOvertimeInput {
  totalHoursWorked: number;
  hourlyRate: number;
  dailyLimit?: number;   // default 8
  otMultiplier?: number;  // default 2
}

export interface WeeklyOvertimeInput {
  dailyHours: number[];   // array of hours for each day
  hourlyRate: number;
  weeklyLimit?: number;   // default 48
  otMultiplier?: number;  // default 2
}

// ── Payslip ─────────────────────────────────────────────────
export interface PayslipInput {
  worker: Pick<Worker, 'basePay' | 'allowances' | 'payType'>;
  shifts: Shift[];
  periodStart: string;  // ISO date
  periodEnd: string;    // ISO date
  policy?: OrgPolicy;
}

export interface PayslipLine {
  key: string;            // i18n key e.g. 'payslip.basePay'
  label: string;          // fallback label
  amount: number;
  type: 'earning' | 'deduction' | 'total';
}

export interface PayslipResult {
  lines: PayslipLine[];
  gross: number;
  totalDeductions: number;
  net: number;
  periodStart: string;
  periodEnd: string;
}

// ── Fatigue ─────────────────────────────────────────────────
export type FatigueFlagType =
  | 'weekly_hours_exceeded'    // >48h in rolling 7 days
  | 'long_shift'              // shift >10h
  | 'short_rest'              // rest gap <10h
  | 'no_rest_day';            // 7+ consecutive days

export interface FatigueFlag {
  type: FatigueFlagType;
  /** i18n key for the explanation */
  messageKey: string;
  /** Actual values for interpolation */
  params: Record<string, string | number>;
}

export interface FatigueInput {
  shifts: Shift[];
  /** ISO date – start of the rolling window */
  windowStart: string;
  /** ISO date – end of the rolling window */
  windowEnd: string;
}

// ── Quit Risk ───────────────────────────────────────────────
export interface QuitRiskFactor {
  factor: string;         // e.g. 'ot_load'
  weight: number;         // how much it contributed (0-100)
  detail: string;         // human-readable detail
}

export interface QuitRiskInput {
  weeklyHours: number;
  fatigueFlags: FatigueFlag[];
  /** Attendance % this month vs last month */
  attendanceDropPct: number;
  unresolvedComplaints: number;
  /** Average of team feedback scores (1-5) */
  teamFeedbackTrend: number;
}

export interface QuitRiskResult {
  score: number;          // 0-100
  topReasons: QuitRiskFactor[];  // top 3
}

// ── Hazard ──────────────────────────────────────────────────
export type HazardSeverity = 'critical' | 'high' | 'medium' | 'low';
export type HazardStatus = 'reported' | 'acknowledged' | 'resolved' | 'escalated';

export interface HazardSlaConfig {
  critical: number;   // hours: 1
  high: number;       // hours: 4
  medium: number;     // hours: 24
  low: number;        // hours: 72
}

export const DEFAULT_HAZARD_SLA: HazardSlaConfig = {
  critical: 1,
  high: 4,
  medium: 24,
  low: 72,
};

export interface HazardReport {
  id: string;
  orgId: string;
  siteId: string;
  /** Worker id or null if anonymous */
  reporterId: string | null;
  category: string;
  description: string;
  severity: HazardSeverity;
  status: HazardStatus;
  /** ISO datetime */
  reportedAt: string;
  /** ISO datetime or null */
  acknowledgedAt: string | null;
  /** ISO datetime or null */
  resolvedAt: string | null;
  /** AI-generated English summary */
  aiSummary: string | null;
  /** AI-suggested severity */
  aiSuggestedSeverity: HazardSeverity | null;
  anonymous: boolean;
}

// ── Feedback ────────────────────────────────────────────────
export interface FeedbackSubmission {
  id: string;
  orgId: string;
  siteId: string;
  team: string;
  /** ISO week string e.g. '2026-W43' */
  isoWeek: string;
  /** No worker id – anonymous by design */
  managerRespect: number;   // 1-5
  safetyRating: number;     // 1-5
  payFairness: number;      // 1-5
  workloadRating: number;   // 1-5
  comment: string | null;
}

export interface AggregatedFeedback {
  team: string;
  isoWeek: string;
  count: number;
  /** Only present if count >= k */
  averages: {
    managerRespect: number;
    safetyRating: number;
    payFairness: number;
    workloadRating: number;
  } | null;
  /** Only present if count >= k */
  comments: string[] | null;
}

// ── Geofence ────────────────────────────────────────────────
export interface GeofenceResult {
  withinRadius: boolean;
  distanceMetres: number;
  siteId: string;
}

// ── QR Code ─────────────────────────────────────────────────
export interface QrCodeResult {
  code: string;
  validFrom: number;   // unix timestamp
  validUntil: number;  // unix timestamp
}

// ── Skills / Passport ───────────────────────────────────────
export interface SkillRecord {
  id: string;
  workerId: string;
  orgId: string;
  title: string;
  issuer: string;
  /** ISO date */
  issuedDate: string;
  /** Optional expiry ISO date */
  expiryDate: string | null;
  /** Public verification token */
  verifyToken: string;
  verified: boolean;
}

// ── API request/response helpers ────────────────────────────
export interface ApiError {
  error: string;
  details?: string;
}

export interface ApiSuccess<T> {
  data: T;
}

// ── Attendance summary ──────────────────────────────────────
export interface DailyAttendance {
  date: string;  // ISO date
  present: number;
  total: number;
}

// ── Overview KPIs ───────────────────────────────────────────
export interface OverviewKPIs {
  onSiteNow: number;
  totalWorkers: number;
  escalatedHazards: number;
  openHazards: number;
  fatigueFlags: number;
  highQuitRisk: number;
}
