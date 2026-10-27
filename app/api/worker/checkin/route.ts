import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/src/server/auth/guard';
import { workerService } from '@/src/server/services/workerService';
import { z } from 'zod';

const checkinInputSchema = z.object({
  siteId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export async function POST(request: NextRequest) {
  const guard = requireSession(request, 'worker');
  if ('errorResponse' in guard) return guard.errorResponse;

  try {
    const body = await request.json();
    const parsed = checkinInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid check-in parameters', details: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const result = await workerService.checkIn(guard.session.userId, parsed.data);
    return NextResponse.json({ data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Check-in failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
