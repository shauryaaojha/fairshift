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

  try {
    const riskRecords = await adminService.getWorkforceRisk(orgId, siteId);
    return NextResponse.json({ data: { workers: riskRecords } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch workforce risk';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
