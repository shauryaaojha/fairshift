const TZ = 'Asia/Kolkata';

const timeFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const dayFmt = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short' });

/** "08:30" in India Standard Time. */
export function fmtTime(iso: string | null): string {
  return iso ? timeFmt.format(new Date(iso)) : '-';
}

/** "27 Oct" in India Standard Time. */
export function fmtDay(iso: string): string {
  return dayFmt.format(new Date(iso));
}

export function fmtDateTime(iso: string | null): string {
  return iso ? `${fmtDay(iso)} ${fmtTime(iso)}` : '-';
}
