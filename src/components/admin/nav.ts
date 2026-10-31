export const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: 'overview', group: 'Today' },
  { href: '/admin/attendance', label: 'Attendance', icon: 'attendance', group: 'Today' },
  { href: '/admin/ask', label: 'Ask Urima', icon: 'ask', group: 'Today' },
  { href: '/admin/safety', label: 'Safety', icon: 'safety', group: 'People' },
  { href: '/admin/feedback', label: 'Feedback', icon: 'feedback', group: 'People' },
  { href: '/admin/risk', label: 'Workforce risk', icon: 'risk', group: 'People' },
  { href: '/admin/pay', label: 'Pay', icon: 'pay', group: 'Money' },
  { href: '/admin/plan', label: 'Plan a shift', icon: 'plan', group: 'Money' },
  { href: '/admin/sites', label: 'Sites', icon: 'sites', group: 'Setup' },
] as const;

/** Rail section headings, in order. */
export const NAV_GROUPS = ['Today', 'People', 'Money', 'Setup'] as const;

export type NavIconKey = (typeof ADMIN_NAV)[number]['icon'];

export function isActive(pathname: string, href: string): boolean {
  return href === '/admin'
    ? pathname === '/admin'
    : pathname === href || pathname.startsWith(`${href}/`);
}
