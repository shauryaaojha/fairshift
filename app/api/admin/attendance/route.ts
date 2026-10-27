import { NextRequest, NextResponse } from 'next/server';
import { requireSession, resolveOrgScope } from '@/src/server/auth/guard';
import { adminService } from '@/src/server/services/adminService';

export async function GET(request: NextRequest) {
  const guard = requireSession(request, 'admin');
  if ('errorResponse' in guard) return guard.errorResponse;

  const { searchParams } = new URL(request.url);
  const scope = resolveOrgScope(guard.session, searchParams.get('orgId'));
  if ('errorResponse' in scope) return scope.errorResponse;
  const orgId = scope.orgId;
  const siteId = searchParams.get('siteId') || undefined;
  if (siteId && (await adminService.getSiteById(siteId))?.orgId !== orgId) {
    return NextResponse.json({ error: 'Forbidden: Site is outside this organisation' }, { status: 403 });
  }
  const days = parseInt(searchParams.get('days') || '14', 10);

  try {
    const trend = await adminService.getAttendanceTrend(orgId, siteId, days);
    return NextResponse.json({ data: { trend } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch attendance data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
