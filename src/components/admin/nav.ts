export const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: 'overview' },
  { href: '/admin/attendance', label: 'Attendance', icon: 'attendance' },
  { href: '/admin/safety', label: 'Safety', icon: 'safety' },
  { href: '/admin/pay', label: 'Pay', icon: 'pay' },
  { href: '/admin/plan', label: 'Plan a shift', icon: 'plan' },
  { href: '/admin/feedback', label: 'Feedback', icon: 'feedback' },
  { href: '/admin/risk', label: 'Workforce risk', icon: 'risk' },
  { href: '/admin/sites', label: 'Sites', icon: 'sites' },
  { href: '/admin/ask', label: 'Ask the console', icon: 'ask' },
] as const;

export type NavIconKey = (typeof ADMIN_NAV)[number]['icon'];

export function isActive(pathname: string, href: string): boolean {
  return href === '/admin'
    ? pathname === '/admin'
    : pathname === href || pathname.startsWith(`${href}/`);
}
