import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/src/server/auth/guard';
import { workerService } from '@/src/server/services/workerService';
import { explainPayslip } from '@/src/server/ai/gemini';
import type { Locale } from '@/src/shared/types';

export async function GET(request: NextRequest) {
  const guard = requireSession(request, 'worker');
  if ('errorResponse' in guard) return guard.errorResponse;

  try {
    const worker = await workerService.getProfile(guard.session.userId);
    const payslip = await workerService.getMyPayslip(guard.session.userId);

    // Optional query param override for locale (e.g. ?lang=hi)
    const { searchParams } = new URL(request.url);
    const locale = (searchParams.get('lang') || worker?.locale || 'en') as Locale;

    const explanation = await explainPayslip(payslip, locale);

    return NextResponse.json({
      data: {
        payslip,
        explanation: explanation.text,
        isAi: explanation.isAi,
        locale,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to calculate payslip';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
