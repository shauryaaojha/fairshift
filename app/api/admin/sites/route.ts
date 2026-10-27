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

  try {
    const sites = await adminService.getSites(orgId);
    return NextResponse.json({ data: { sites } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch sites';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
