'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_NAV, NAV_GROUPS, isActive } from './nav';
import { NavIcon } from './NavIcon';

/** Left rail, shown at 1024 px and wider, in labelled groups. Below that the stairs menu takes over. */
export function AdminRail({ sector }: { sector: 'construction' | 'college' }) {
  const pathname = usePathname();
  return (
    <nav className="rail-nav" aria-label="Admin sections">
      {NAV_GROUPS.map((group) => (
        <div key={group} className="rail-group">
          <p className="rail-heading" id={`rail-${group}`}>
            {group}
          </p>
          <ul aria-labelledby={`rail-${group}`}>
            {ADMIN_NAV.filter((item) => item.group === group).map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className="rail-link"
                    data-active={active || undefined}
                  >
                    <NavIcon icon={item.icon} sector={sector} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
