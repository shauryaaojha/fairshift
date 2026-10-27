"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, isActive } from "./nav";
import { NavIcon } from "./NavIcon";

/** Left rail, shown at 1024 px and wider. Below that the stairs menu takes over. */
export function AdminRail({ sector }: { sector: "construction" | "college" }) {
  const pathname = usePathname();
  return (
    <nav className="rail" aria-label="Admin sections">
      <ul>
        {ADMIN_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
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
    </nav>
  );
}
