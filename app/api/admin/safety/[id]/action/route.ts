import { NextRequest, NextResponse } from 'next/server';
import { allowedOrgIds, requireSession } from '@/src/server/auth/guard';
import { adminService } from '@/src/server/services/adminService';
import { z } from 'zod';

const actionSchema = z.object({
  action: z.enum(['acknowledge', 'resolve']),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = requireSession(request, 'admin');
  if ('errorResponse' in guard) return guard.errorResponse;

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Action must be "acknowledge" or "resolve"' }, { status: 400 });
    }

    let updated;
    if (parsed.data.action === 'acknowledge') {
      updated = await adminService.acknowledgeHazard(id, allowedOrgIds(guard.session));
    } else {
      updated = await adminService.resolveHazard(id, allowedOrgIds(guard.session));
    }

    return NextResponse.json({ data: { hazard: updated, message: `Hazard marked as ${parsed.data.action}d` } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Action failed';
    return NextResponse.json({ error: message }, { status: message === 'Hazard not found' ? 404 : 400 });
  }
}
