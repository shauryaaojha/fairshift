/**
 * Server environment, parsed once with zod.
 *
 * Every variable is optional for local development: with none set, FairShift runs on seeded
 * in-memory data, a fixed local session secret and rule-based AI fallbacks. A malformed value
 * (say, a MONGODB_URI that is not a mongodb:// URL) fails with one readable message instead of a
 * driver stack trace. SESSION_SECRET is enforced where it is used (src/server/auth/session.ts),
 * so `next build` works without it but a production request never runs on the dev secret.
 *
 * Read lazily (on first use, not at import) so `next build` never needs runtime secrets.
 */

import { z } from 'zod';

/** `KEY=` in a .env file arrives as an empty string; treat it as unset. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    schema.optional(),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: optional(
    z.string().regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://'),
  ),
  MONGODB_DB: optional(z.string().regex(/^[A-Za-z0-9_-]{1,38}$/, 'must be a plain database name')),
  DATA_BACKEND: optional(z.enum(['memory', 'mongodb'])),
  SESSION_SECRET: optional(z.string().min(16, 'must be at least 16 characters')),
  GEMINI_API_KEY: optional(z.string()),
  GEMINI_MODEL: optional(z.string().regex(/^[A-Za-z0-9._-]+$/, 'must be a model id')),
});

export interface ServerEnv {
  nodeEnv: 'development' | 'production' | 'test';
  mongoUri: string | null;
  mongoDb: string;
  /** Which store serves data. `mongodb` only when a URI is set and memory is not forced. */
  dataBackend: 'memory' | 'mongodb';
  sessionSecret: string | null;
  geminiApiKey: string | null;
  geminiModel: string;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/** Pure parser, exported for tests. Throws one error listing every bad variable. */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.')} ${issue.message}`)
      .join('; ');
    throw new Error(`[FairShift] Invalid environment: ${problems}. See .env.example.`);
  }
  const env = result.data;
  return {
    nodeEnv: env.NODE_ENV,
    mongoUri: env.MONGODB_URI ?? null,
    mongoDb: env.MONGODB_DB ?? 'fairshift',
    dataBackend: env.MONGODB_URI && env.DATA_BACKEND !== 'memory' ? 'mongodb' : 'memory',
    sessionSecret: env.SESSION_SECRET ?? null,
    geminiApiKey: env.GEMINI_API_KEY ?? null,
    geminiModel: env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
  };
}

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  return (cached ??= parseServerEnv(process.env));
}

/** Tests change process.env between cases; this drops the cached parse. */
export function resetServerEnvForTests(): void {
  cached = null;
}
