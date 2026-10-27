export const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: 'overview' },
  { href: '/admin/attendance', label: 'Attendance', icon: 'attendance' },
  { href: '/admin/safety', label: 'Safety', icon: 'safety' },
  { href: '/admin/feedback', label: 'Feedback', icon: 'feedback' },
  { href: '/admin/risk', label: 'Workforce risk', icon: 'risk' },
  { href: '/admin/sites', label: 'Sites', icon: 'sites' },
] as const;

export type NavIconKey = (typeof ADMIN_NAV)[number]['icon'];

export function isActive(pathname: string, href: string): boolean {
  return href === '/admin'
    ? pathname === '/admin'
    : pathname === href || pathname.startsWith(`${href}/`);
}
