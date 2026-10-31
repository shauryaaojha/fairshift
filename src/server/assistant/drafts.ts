/**
 * Urima can do two jobs from what a worker says, not only answer: report a hazard and give
 * feedback. It never does them alone. It fills a draft from the words, the app shows the draft,
 * and only the worker's own tap on Send files it, through the same action and checks as the form
 * (rate limit, schema, the danger-word severity floor). Detection is rule-based in English, Hindi
 * and Tamil, so it works with no AI key and no quota, and a model cannot be talked into filing.
 * Pure.
 */

import { severityFloor } from '../domain/hazardSignals';
import { getSlaHours } from '../domain/hazardSla';
import type { HazardSeverity } from '../../shared/types';

export const DRAFT_CATEGORIES = ['fall', 'electric', 'fire', 'equipment'] as const;
export type DraftCategory = (typeof DRAFT_CATEGORIES)[number];

export type ActionDraft =
  | {
      kind: 'hazard';
      category: DraftCategory;
      severity: HazardSeverity;
      description: string;
      /** The response deadline the report will get, so the worker knows before sending. */
      deadlineHours: number;
    }
  | { kind: 'feedback'; comment: string };

/** Things a worker names when something is unsafe. First match sets the category. */
const CATEGORY_WORDS: Array<{ category: DraftCategory; pattern: RegExp }> = [
  {
    category: 'electric',
    pattern:
      /wire|electric|shock|current|cable|switch ?board|bijli|करंट|बिजली|तार|स्विच|மின்|வயர்|கம்பி|ஷாக்/i,
  },
  {
    category: 'fire',
    pattern: /fire|smoke|gas|burn|spark|आग|धुआँ|धुआं|गैस|चिंगारी|தீ|புகை|எரிவாயு|கேஸ்/i,
  },
  {
    category: 'fall',
    pattern:
      /ladder|scaffold|railing|fall|fell|height|harness|edge|slab|गिर|सीढ़ी|मचान|रेलिंग|ऊँचाई|ऊंचाई|बेल्ट|ஏணி|சாரம்|விழ|உயர|கைப்பிடி/i,
  },
  {
    category: 'equipment',
    pattern:
      /machine|crane|guard|drill|mixer|grinder|tool|मशीन|क्रेन|ड्रिल|मिक्सर|औज़ार|औजार|இயந்திர|கிரேன்|டிரில்|கருவி/i,
  },
];

/** How a worker talks about their supervisor or conditions: this is feedback, not a hazard. */
const FEEDBACK_WORDS =
  /supervisor|manager|shout|abuse|rude|insult|scold|harass|threat|सुपरवाइज़र|सुपरवाइजर|मैनेजर|ठेकेदार|चिल्ला|गाली|डाँट|डांट|धमका|बदतमीज़|மேற்பார்வையாளர்|மேனேஜர்|கத்து|திட்டு|மிரட்ட/i;

/** Asking about something already reported, or about rules, is a question to answer. */
const QUESTION_ABOUT =
  /what happened|status|any update|rule|law|kya hua|क्या हुआ|स्थिति|नियम|कानून|என்ன ஆனது|நிலை|விதி|சட்ட/i;

/** Pay talk ("I was shocked by my pay") must not become an electrical hazard. */
const PAY_TALK = /pay|salary|wage|overtime|वेतन|पैसे|तनख्वाह|ओवरटाइम|சம்பளம்|ஊதியம்|ஓவர்டைம்/i;

/**
 * The draft a message calls for, or null when it is a question for the assistant to answer.
 * A hazard wins over feedback ("the supervisor ignores the broken ladder" is a hazard).
 */
export function draftFromMessage(message: string): ActionDraft | null {
  const text = message.trim();
  if (text.length < 8 || QUESTION_ABOUT.test(text)) return null;

  const category = PAY_TALK.test(text)
    ? undefined
    : CATEGORY_WORDS.find((c) => c.pattern.test(text))?.category;
  if (category) {
    const severity = severityFloor('medium', text);
    return {
      kind: 'hazard',
      category,
      severity,
      description: text,
      deadlineHours: getSlaHours(severity),
    };
  }
  if (FEEDBACK_WORDS.test(text)) return { kind: 'feedback', comment: text };
  return null;
}
