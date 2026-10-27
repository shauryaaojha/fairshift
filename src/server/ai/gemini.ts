// AI: Vertex AI Gemini Integration

import { GoogleGenAI } from '@google/genai';
import type { PayslipResult, HazardSeverity, Locale } from '../../shared/types';
import {
  explainPayslipFallback,
  summarizeHazardFallback,
  generateWeeklySafetySummaryFallback,
} from './fallbacks';

export const AI_EXPLANATION_DISCLAIMER = 'Explained by AI · check with your supervisor';

const TIMEOUT_MS = 12000;
/** Short explanations need no extended reasoning; skipping it roughly halves latency. */
const FAST_CONFIG = { thinkingConfig: { thinkingBudget: 0 } };

function getGeminiClient(): { client: GoogleGenAI; model: string } | null {
  // Server-only key from a Vercel environment variable; never exposed to the browser.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  try {
    return { client: new GoogleGenAI({ apiKey }), model };
  } catch (err) {
    console.warn('[FairShift AI] Failed to initialise the Gemini client:', err);
    return null;
  }
}

/**
 * Executes a promise with an 8-second timeout.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI request timed out after 8s')), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Explains a worker's payslip in their chosen language (en, hi, ta).
 * Fallbacks to deterministic text if Vertex AI is unavailable or times out.
 */
export async function explainPayslip(
  payslip: PayslipResult,
  locale: Locale = 'en',
): Promise<{ text: string; isAi: boolean }> {
  const vertex = getGeminiClient();
  if (!vertex) {
    return {
      text: explainPayslipFallback(payslip, locale),
      isAi: false,
    };
  }

  try {
    const prompt = `You are FairShift's worker wage assistant. Explain this payslip clearly and simply to a worker in language code '${locale}' (en = English, hi = Hindi, ta = Tamil).
Keep it under 3 short sentences. Be encouraging and respectful.
Data:
- Net take-home pay: ₹${payslip.net}
- Gross wages: ₹${payslip.gross}
- Total statutory deductions: ₹${payslip.totalDeductions}
- Items: ${payslip.lines.map((l) => `${l.label}: ₹${l.amount}`).join(', ')}
Do not invent any numbers. Only use the numbers provided above.`;

    const response = await withTimeout(
      vertex.client.models.generateContent({
        model: vertex.model,
        contents: prompt,
        config: FAST_CONFIG,
      }),
    );

    const text = response.text?.trim();
    if (text) {
      return { text, isAi: true };
    }
  } catch (err) {
    console.warn('[FairShift AI] Gemini payslip explanation failed or timed out:', err);
  }

  return {
    text: explainPayslipFallback(payslip, locale),
    isAi: false,
  };
}

/**
 * Summarizes a hazard report into concise English and suggests/confirms severity.
 */
export async function summarizeHazard(
  category: string,
  description: string,
  severity: HazardSeverity,
): Promise<{ summary: string; suggestedSeverity: HazardSeverity; isAi: boolean }> {
  const fallback = summarizeHazardFallback(category, description, severity);
  const vertex = getGeminiClient();
  if (!vertex) {
    return { ...fallback, isAi: false };
  }

  try {
    const prompt = `You are a site safety officer. Summarize this workplace safety hazard report into one crisp sentence in English (under 25 words).
Category: ${category}
Report description: ${description}
Current worker-selected severity: ${severity}
Respond with a single English summary sentence.`;

    const response = await withTimeout(
      vertex.client.models.generateContent({
        model: vertex.model,
        contents: prompt,
        config: FAST_CONFIG,
      }),
    );

    const summary = response.text?.trim();
    if (summary) {
      return {
        summary,
        suggestedSeverity: severity,
        isAi: true,
      };
    }
  } catch (err) {
    console.warn('[FairShift AI] Gemini hazard summary failed or timed out:', err);
  }

  return { ...fallback, isAi: false };
}

/**
 * Generates an executive safety and operations overview for management.
 */
export async function generateWeeklySafetySummary(stats: {
  onSiteNow: number;
  totalWorkers: number;
  escalatedHazards: number;
  openHazards: number;
  fatigueFlags: number;
  highQuitRisk: number;
}): Promise<{ summary: string; isAi: boolean }> {
  const fallback = generateWeeklySafetySummaryFallback(stats);
  const vertex = getGeminiClient();
  if (!vertex) {
    return { summary: fallback, isAi: false };
  }

  try {
    const prompt = `You are an operations intelligence analyst for a workforce safety platform.
Write a 2-3 sentence executive briefing for the site supervisor based on these operational metrics:
- On site today: ${stats.onSiteNow} of ${stats.totalWorkers} workers
- Escalated safety hazards (breached SLA): ${stats.escalatedHazards}
- Open safety hazards: ${stats.openHazards}
- Active fatigue flags: ${stats.fatigueFlags}
- High quit-risk workers: ${stats.highQuitRisk}
Use professional, proactive tone. Highlight immediate action points.`;

    const response = await withTimeout(
      vertex.client.models.generateContent({
        model: vertex.model,
        contents: prompt,
        config: FAST_CONFIG,
      }),
    );

    const summary = response.text?.trim();
    if (summary) {
      return { summary, isAi: true };
    }
  } catch (err) {
    console.warn('[FairShift AI] Gemini executive summary failed or timed out:', err);
  }

  return { summary: fallback, isAi: false };
}
