import { NextRequest, NextResponse } from 'next/server';
import { getPassportByToken } from '@/src/server/services/adminUi';

/** Public verify endpoint: returns the same first-name-only view as the passport page. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const view = await getPassportByToken(token);
  if (!view) {
    return NextResponse.json({ error: 'Skill passport record not found' }, { status: 404 });
  }
  return NextResponse.json({ data: view });
}
