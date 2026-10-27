import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/src/server/auth/guard';
import { workerService } from '@/src/server/services/workerService';
import { checkoutSchema } from '@/src/shared/schemas';

export async function POST(request: NextRequest) {
  const guard = requireSession(request, 'worker');
  if ('errorResponse' in guard) return guard.errorResponse;

  try {
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid checkout parameters', details: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const updatedShift = await workerService.checkOut(guard.session.userId, parsed.data.shiftId);
    return NextResponse.json({ data: { shift: updatedShift, message: 'Checked out successfully' } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
