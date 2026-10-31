/**
 * Deterministic text used whenever Gemini is not configured, fails or is rate-limited: payslip
 * explanations in English, Hindi and Tamil, hazard summaries with a keyword severity hint, and
 * the supervisor briefing.
 */

import type { PayslipResult, HazardSeverity, Locale } from '../../shared/types';
import type { WeeklyStats } from './gemini';
import { higherSeverity } from '../../shared/severity';
import { suggestSeverityFromText } from '../domain/hazardSignals';

/**
 * Deterministic explanation of a payslip in English, Hindi, or Tamil.
 */
export function explainPayslipFallback(payslip: PayslipResult, locale: Locale = 'en'): string {
  const baseLine = payslip.lines.find((l) => l.key === 'payslip.basePay');
  const otLine = payslip.lines.find((l) => l.key === 'payslip.overtime');
  const allowLine = payslip.lines.find((l) => l.key === 'payslip.allowances');
  const pfLine = payslip.lines.find((l) => l.key === 'payslip.pf');
  const esiLine = payslip.lines.find((l) => l.key === 'payslip.esi');

  const base = baseLine?.amount ?? 0;
  const ot = otLine?.amount ?? 0;
  const allow = allowLine?.amount ?? 0;
  const pf = pfLine?.amount ?? 0;
  const esi = esiLine?.amount ?? 0;
  const net = payslip.net;

  if (locale === 'hi') {
    let msg = `आपका कुल वेतन ₹${net.toLocaleString('en-IN')} है। इसमें मूल पारिश्रमिक के ₹${base.toLocaleString('en-IN')}`;
    if (ot > 0) msg += ` और कानूनी 2x दर पर ओवरटाइम के ₹${ot.toLocaleString('en-IN')}`;
    if (allow > 0) msg += ` तथा भत्ते के ₹${allow.toLocaleString('en-IN')}`;
    msg += ` शामिल हैं।`;
    if (pf > 0 || esi > 0) {
      msg += ` सरकारी सुरक्षा हेतु भविष्य निधि (PF) ₹${pf} और ईएसआई स्वास्थ्य सुरक्षा (ESI) ₹${esi} सीधे आपके खाते में जमा हुए हैं।`;
    }
    return msg;
  }

  if (locale === 'ta') {
    let msg = `உங்கள் நிகர ஊதியம் ₹${net.toLocaleString('en-IN')} ஆகும். இதில் அடிப்படை ஊதியம் ₹${base.toLocaleString('en-IN')}`;
    if (ot > 0) {
      msg += ` மற்றும் இரட்டிப்பு (2x) கூடுதல் நேர ஊதியம் (OT) ₹${ot.toLocaleString('en-IN')}`;
    }
    if (allow > 0) msg += ` மற்றும் படிகள் ₹${allow.toLocaleString('en-IN')}`;
    msg += ` அடங்கும்.`;
    if (pf > 0 || esi > 0) {
      msg += ` உங்கள் சட்டப்பூர்வ நலனுக்காக PF ₹${pf} மற்றும் ESI மருத்துவ காப்பீடு ₹${esi} பிடித்தம் செய்யப்பட்டுள்ளது.`;
    }
    return msg;
  }

  // English default
  let msg = `Your net take-home pay is ₹${net.toLocaleString('en-IN')}. This comprises ₹${base.toLocaleString('en-IN')} base pay`;
  if (ot > 0) msg += ` plus ₹${ot.toLocaleString('en-IN')} overtime paid at double rate (2x)`;
  if (allow > 0) msg += ` and ₹${allow.toLocaleString('en-IN')} in allowances`;
  msg += `.`;
  if (pf > 0 || esi > 0) {
    msg += ` Statutory contributions of ₹${pf} for PF and ₹${esi} for ESI healthcare were deposited to your official welfare accounts.`;
  }
  return msg;
}

/**
 * Deterministic hazard summary and severity suggestion (never below the worker's own rating).
 */
export function summarizeHazardFallback(
  category: string,
  description: string,
  severity: HazardSeverity,
): { summary: string; suggestedSeverity: HazardSeverity } {
  const cleanDesc = description.trim().replace(/\s+/g, ' ');
  const firstSentence = cleanDesc.split(/[.!?।]/)[0] || cleanDesc;
  const summary = `Reported ${category.toLowerCase()} issue: "${firstSentence.slice(0, 160)}".`;
  const signal = suggestSeverityFromText(cleanDesc);

  return {
    summary,
    suggestedSeverity: signal ? higherSeverity(severity, signal) : severity,
  };
}

/**
 * Deterministic executive summary for admin overview.
 */
export function generateWeeklySafetySummaryFallback(stats: WeeklyStats): string {
  const parts: string[] = [
    `Workforce presence is at ${stats.onSiteNow} of ${stats.totalWorkers} registered personnel today.`,
  ];

  if (stats.escalatedHazards > 0) {
    parts.push(
      `Attention required: ${stats.escalatedHazards} hazard report(s) have crossed the statutory acknowledgement SLA and are escalated.`,
    );
  } else if (stats.openHazards > 0) {
    parts.push(
      `${stats.openHazards} open hazard report(s) remain actively monitored within safety SLAs.`,
    );
  } else {
    parts.push(`All reported site hazard items are currently acknowledged or resolved.`);
  }

  if (stats.fatigueFlags > 0 || stats.highQuitRisk > 0) {
    parts.push(
      `${stats.fatigueFlags} worker(s) trigger fatigue limits (>48h or consecutive shifts), contributing to ${stats.highQuitRisk} high quit-risk case(s).`,
    );
  } else {
    parts.push(`Fatigue and attrition indicators remain within standard operational bounds.`);
  }

  return parts.join(' ');
}
