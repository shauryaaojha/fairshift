import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/src/server/auth/guard';
import { workerService } from '@/src/server/services/workerService';

export async function GET(request: NextRequest) {
  const guard = requireSession(request, 'worker');
  if ('errorResponse' in guard) return guard.errorResponse;

  try {
    const status = await workerService.getTodayStatus(guard.session.userId);
    const worker = await workerService.getProfile(guard.session.userId);
    return NextResponse.json({ data: { status, worker } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
