import { connection, NextResponse } from 'next/server';
import { serverEnv } from '@/src/server/env';
import { pingMongo } from '@/src/server/repos/mongo';
import { withTimeout } from '@/src/server/ai/client';

/**
 * Liveness and readiness for uptime checks and the README's "is it running?" step.
 * Reports which data store and whether AI are configured, never a value or a secret.
 */
export async function GET() {
  await connection();
  const env = serverEnv();
  let database: 'memory' | 'reachable' | 'unreachable' = 'memory';
  if (env.dataBackend === 'mongodb') {
    database = await withTimeout(pingMongo(), 3000)
      .then(() => 'reachable' as const)
      .catch(() => 'unreachable' as const);
  }
  // The app keeps serving seeded data when MongoDB is down, so that is "degraded", not "down".
  const status = database === 'unreachable' ? 'degraded' : 'ok';
  return NextResponse.json(
    {
      status,
      dataBackend: env.dataBackend,
      database,
      ai: env.geminiApiKey ? 'gemini' : 'rule-based fallback',
      time: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
