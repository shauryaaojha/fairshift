import { NextRequest, NextResponse } from 'next/server';
import { allowedOrgIds, requireSession } from '@/src/server/auth/guard';
import { adminService } from '@/src/server/services/adminService';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = requireSession(request, 'admin');
  if ('errorResponse' in guard) return guard.errorResponse;

  const { id } = await context.params;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host;
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');

  try {
    const kioskData = await adminService.getKioskData(id, allowedOrgIds(guard.session), `${proto}://${host}`);
    return NextResponse.json({ data: kioskData });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate kiosk QR';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
