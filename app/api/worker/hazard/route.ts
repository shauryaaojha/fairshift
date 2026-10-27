import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/src/server/auth/guard';
import { workerService } from '@/src/server/services/workerService';
import { hazardReportSchema } from '@/src/shared/schemas';
import { checkRateLimit } from '@/src/server/auth/rateLimit';

export async function POST(request: NextRequest) {
  const guard = requireSession(request, 'worker');
  if ('errorResponse' in guard) return guard.errorResponse;

  const rateLimit = checkRateLimit(`hazard:${guard.session.userId}`, 10, 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many submissions. Try again in ${rateLimit.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const parsed = hazardReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid hazard report', details: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const hazard = await workerService.reportHazard(guard.session.userId, parsed.data);
    return NextResponse.json({ data: { hazard, message: 'Hazard reported successfully' } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit hazard';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
