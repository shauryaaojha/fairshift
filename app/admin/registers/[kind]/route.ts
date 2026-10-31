import { z } from 'zod';
import { getAdminContext } from '../../_lib/context';
import { getRegister } from '@/src/server/services/adminPages';
import { checkRateLimit } from '@/src/server/auth/rateLimit';
import { isAppError } from '@/src/shared/errors';

const querySchema = z.object({
  kind: z.enum(['attendance', 'wages']),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must look like 2026-10')
    .optional(),
});

/**
 * GET /admin/registers/attendance?month=2026-10 (or /wages): the register for the console's
 * current sector as a CSV download. Admin session required; the sector is checked against it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const ctx = await getAdminContext();
  if (!checkRateLimit(`register:${ctx.userId}`, 20, 60 * 1000).allowed) {
    return new Response('Too many downloads. Wait a minute and try again.', { status: 429 });
  }

  const month = new URL(request.url).searchParams.get('month') || undefined;
  const parsed = querySchema.safeParse({ kind: (await params).kind, month });
  if (!parsed.success) {
    return new Response(parsed.error.issues[0]?.message ?? 'Invalid request', { status: 400 });
  }

  try {
    const { filename, csv } = await getRegister(
      ctx.sector.key,
      parsed.data.kind,
      parsed.data.month,
    );
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (isAppError(err) && err.code === 'validation') {
      return new Response(err.message, { status: 400 });
    }
    console.error('[FairShift] register export failed:', err);
    return new Response('Could not build the register. Try again.', { status: 500 });
  }
}
