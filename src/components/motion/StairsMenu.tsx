'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { prefersReducedMotion, setupGsap } from './gsapSetup';

export interface StairsItem {
  href: string;
  label: string;
}

const BARS = 5;

/**
 * Sliding-stairs menu for the admin under 1024 px (technique from
 * Navigation Menus/5): five graphite bars grow with a stagger, the links
 * flip in from rotateX(90). Plays in reverse on close. With reduced motion
 * the panel simply appears. `footer` holds the sector switcher and sign-out.
 */
export function StairsMenu({ items, footer }: { items: StairsItem[]; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement | null>(null);
  const burger = useRef<HTMLButtonElement | null>(null);
  const first = useRef(true);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const bars = el.querySelectorAll<HTMLElement>('[data-bar]');
    const links = el.querySelectorAll<HTMLElement>('[data-link]');
    const content = el.querySelector<HTMLElement>('[data-content]');
    if (!content) return;

    if (prefersReducedMotion()) {
      el.style.visibility = open ? 'visible' : 'hidden';
      content.style.opacity = open ? '1' : '0';
      bars.forEach((b) => (b.style.height = open ? '100%' : '0%'));
      return;
    }

    const { gsap } = setupGsap();
    gsap.killTweensOf([bars, links, content]);
    if (open) {
      el.style.visibility = 'visible';
      const tl = gsap.timeline();
      tl.fromTo(
        bars,
        { height: '0%' },
        { height: '100%', duration: 0.5, stagger: { each: 0.05, from: 'end' }, ease: 'glide' },
        0,
      );
      tl.to(content, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0.4);
      tl.fromTo(
        links,
        { rotateX: 90, opacity: 0 },
        { rotateX: 0, opacity: 1, duration: 0.45, stagger: 0.05, ease: 'power2.out' },
        0.45,
      );
    } else {
      const tl = gsap.timeline({
        onComplete: () => {
          el.style.visibility = 'hidden';
        },
      });
      tl.to(content, { opacity: 0, duration: 0.2, ease: 'power2.out' }, 0);
      tl.to(
        bars,
        { height: '0%', duration: 0.3, stagger: { each: 0.05, from: 'start' }, ease: 'glide' },
        0.1,
      );
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        burger.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="stairs-wrap">
      <button
        ref={burger}
        type="button"
        className="stairs-burger"
        aria-expanded={open}
        aria-controls="stairs-panel"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Close menu' : 'Menu'}
      </button>
      <div
        id="stairs-panel"
        ref={root}
        className="stairs"
        style={{ visibility: 'hidden' }}
        inert={!open}
        role="region"
        aria-label="Admin sections"
      >
        <div className="stairs-bars" aria-hidden="true">
          {Array.from({ length: BARS }, (_, i) => (
            <span key={i} data-bar="" className="stairs-bar" />
          ))}
        </div>
        <div data-content="" className="stairs-content" style={{ opacity: 0 }}>
          <ul>
            {items.map((item) => (
              <li key={item.href} data-link="">
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  onClick={close}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {footer && <div className="stairs-footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
