import { z } from 'zod';

// ── Auth Schemas ────────────────────────────────────────────
export const workerLoginSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// ── Check-in Schemas ────────────────────────────────────────
export const checkinQrSchema = z.object({
  siteId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const checkinGpsSchema = z.object({
  siteId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const checkoutSchema = z.object({
  shiftId: z.string().min(1),
});

// ── Hazard Schemas ──────────────────────────────────────────
export const hazardReportSchema = z.object({
  siteId: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1).max(2000),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  anonymous: z.boolean().default(false),
});

export const hazardActionSchema = z.object({
  hazardId: z.string().min(1),
  action: z.enum(['acknowledge', 'resolve']),
});

// ── Feedback Schema ─────────────────────────────────────────
export const feedbackSchema = z.object({
  siteId: z.string().min(1),
  managerRespect: z.number().int().min(1).max(5),
  safetyRating: z.number().int().min(1).max(5),
  payFairness: z.number().int().min(1).max(5),
  workloadRating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).nullable().default(null),
});

// ── Skill Schema ────────────────────────────────────────────
export const skillRecordSchema = z.object({
  title: z.string().min(1).max(200),
  issuer: z.string().min(1).max(200),
  issuedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
});

// ── Admin filter schemas ────────────────────────────────────
export const dateRangeSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const siteFilterSchema = z.object({
  siteId: z.string().optional(),
  orgId: z.string().min(1),
});
