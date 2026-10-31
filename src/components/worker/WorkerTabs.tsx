'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AskIcon, ClockCardIcon, ConeIcon, HomeIcon, RupeeNoteIcon } from '@/src/components/icons';
import { useT } from '@/src/i18n/client';

const TABS = [
  { href: '/w', label: 'tab.home', Icon: HomeIcon },
  { href: '/w/hours', label: 'tab.hours', Icon: ClockCardIcon },
  { href: '/w/pay', label: 'tab.pay', Icon: RupeeNoteIcon },
  { href: '/w/hazard', label: 'tab.safety', Icon: ConeIcon },
  { href: '/w/ask', label: 'tab.ask', Icon: AskIcon },
] as const;

/** Where the bar would only get in the way: signing in, and the printable letter. */
export function tabsHidden(path: string): boolean {
  return path.startsWith('/w/login') || path.endsWith('/letter');
}

export function isTabActive(path: string, href: string): boolean {
  return href === '/w' ? path === '/w' : path === href || path.startsWith(`${href}/`);
}

/** Five places a worker goes most, always one thumb-tap away at the bottom of the screen. */
export function WorkerTabs() {
  const t = useT();
  const path = usePathname() ?? '/w';
  if (tabsHidden(path)) return null;
  return (
    <nav aria-label={t('tab.label')} className="worker-tabs no-print">
      <ul>
        {TABS.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="worker-tab"
              aria-current={isTabActive(path, href) ? 'page' : undefined}
            >
              <Icon size={24} />
              <span>{t(label)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
