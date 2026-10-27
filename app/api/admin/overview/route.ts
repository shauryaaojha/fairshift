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
    const kpis = await adminService.getOverviewKPIs(orgId, siteId);
    const aiSummary = await adminService.getAiSummary(orgId, siteId);
    const attendance = await adminService.getAttendanceTrend(orgId, siteId, 14);
    const safetyQueue = await adminService.getSafetyQueue(orgId, siteId);
    const risk = await adminService.getWorkforceRisk(orgId, siteId);

    return NextResponse.json({
      data: {
        kpis,
        aiSummary: aiSummary.summary,
        isAi: aiSummary.isAi,
        attendance,
        escalatedQueue: safetyQueue.filter((h) => h.status === 'escalated' || h.status === 'reported').slice(0, 5),
        topRiskWorkers: risk.slice(0, 5),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch overview data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
