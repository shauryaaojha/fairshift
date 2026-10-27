import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/src/server/auth/guard';
import { workerService } from '@/src/server/services/workerService';
import { getDatabase } from '@/src/server/repos';

export async function GET(request: NextRequest) {
  const guard = requireSession(request);
  if ('errorResponse' in guard) {
    return guard.errorResponse;
  }

  const { session } = guard;

  if (session.role === 'worker') {
    const worker = await workerService.getProfile(session.userId);
    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }
    return NextResponse.json({ data: { user: worker, role: 'worker' } });
  } else {
    const db = getDatabase();
    const admin = await db.admins.getById(session.userId);
    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }
    const { passwordHash: _, ...adminData } = admin;
    return NextResponse.json({ data: { user: adminData, role: 'admin' } });
  }
}
