/**
 * Labour rights shown on "Know your rights" and given to the assistant, each with the law it comes
 * from. The wording a worker sees lives in the dictionaries (`rights.<id>.title` / `.body`); the
 * English `fact` here is what the assistant is grounded on. Citations were checked against the
 * Code on Wages, 2019 as passed by Parliament. The four labour codes came into force on
 * 21 November 2025; a state's rules can add to them but not take these away.
 */

export interface Right {
  id: string;
  /** The law and section, kept in English: it is how an officer or a lawyer will look it up. */
  source: string;
  fact: string;
}

export const LABOUR_CODES_IN_FORCE = '2025-11-21';

export const RIGHTS: readonly Right[] = [
  {
    id: 'overtime',
    source: 'Code on Wages, 2019, s. 14',
    fact: 'Every hour worked beyond the normal working day is paid at no less than twice the normal rate.',
  },
  {
    id: 'payday',
    source: 'Code on Wages, 2019, s. 17(1)',
    fact: 'Daily wages are due at the end of the shift, weekly wages before the weekly holiday, and monthly wages before the 7th of the next month.',
  },
  {
    id: 'leaving',
    source: 'Code on Wages, 2019, s. 17(2)',
    fact: 'A worker who resigns, is removed or retrenched, or loses work because the establishment closed is paid within two working days.',
  },
  {
    id: 'deductions',
    source: 'Code on Wages, 2019, s. 18',
    fact: 'Only deductions the Code allows may be made, and together they may not exceed half of the wages.',
  },
  {
    id: 'equalPay',
    source: 'Code on Wages, 2019, s. 3',
    fact: 'Women and men doing the same or similar work for the same employer get the same wages.',
  },
  {
    id: 'restDay',
    source: 'Code on Wages, 2019, s. 13',
    fact: 'Workers get a day of rest in every seven days, and work on a rest day is paid at no less than the overtime rate.',
  },
  {
    id: 'pfEsi',
    source: 'Code on Social Security, 2020',
    fact: 'The PF and ESI cut from wages is the worker’s own saving and health cover, and the employer pays its own share on top.',
  },
  {
    id: 'safety',
    source: 'OSH Code, 2020, s. 6',
    fact: 'The employer must keep the workplace free of hazards that can cause injury or illness.',
  },
] as const;

export interface Helpline {
  id: string;
  /** Digits dialled, also used for the `tel:` link. */
  number: string;
}

/** National numbers only, each checked against the operator or the DoT short-code allotment. */
export const HELPLINES: readonly Helpline[] = [
  { id: 'emergency', number: '112' },
  { id: 'ambulance', number: '108' },
  { id: 'epfo', number: '14470' },
  { id: 'esic', number: '1800112526' },
  { id: 'labour', number: '14434' },
  { id: 'women', number: '181' },
  { id: 'legalAid', number: '15100' },
] as const;

export interface ComplaintStep {
  id: string;
  /** In-app path, web address or `tel:` link; none when the worker goes in person. */
  href?: string;
  /** What the assistant is grounded on. */
  fact: string;
}

/**
 * Where to take a pay or safety problem, nearest first. SAMADHAN is the Labour Ministry's portal
 * for wage claims and disputes (free to file, also through a Common Service Centre); 15100 is
 * NALSA's free legal aid line, a DoT short code.
 */
export const COMPLAINT_STEPS: readonly ComplaintStep[] = [
  {
    id: 'employer',
    href: '/w/pay/query',
    fact: 'Raise a pay query in FairShift. The employer must answer, and it closes only when the worker agrees it is settled.',
  },
  {
    id: 'samadhan',
    href: 'https://samadhan.labour.gov.in',
    fact: 'File a wage claim or complaint on the Labour Ministry SAMADHAN portal (samadhan.labour.gov.in). It is free, and a Common Service Centre can file it for you.',
  },
  {
    id: 'labourOffice',
    fact: 'Go to the labour office (Labour Commissioner) of your district with your payslips and attendance.',
  },
  {
    id: 'legalAid',
    href: 'tel:15100',
    fact: 'Call 15100, the national free legal aid helpline (NALSA), to speak to a lawyer for free.',
  },
] as const;

/** "1800112526" -> "1800-11-2526"; short codes stay as they are. */
export function formatHelpline(number: string): string {
  return /^1800\d{6}$/.test(number)
    ? `${number.slice(0, 4)}-${number.slice(4, 6)}-${number.slice(6)}`
    : number;
}
