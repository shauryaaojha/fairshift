import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/src/server/auth/guard';
import { workerService } from '@/src/server/services/workerService';

export async function GET(request: NextRequest) {
  const guard = requireSession(request, 'worker');
  if ('errorResponse' in guard) return guard.errorResponse;

  try {
    const skills = await workerService.getMySkills(guard.session.userId);
    return NextResponse.json({ data: { skills } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve skills';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
