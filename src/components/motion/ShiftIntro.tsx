'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { prefersReducedMotion, setupGsap } from './gsapSetup';
import '@/src/components/landing/landing.css';

const SEEN_KEY = 'fairshift-intro-seen';

/**
 * Landing intro (technique from Hero Animations/22, re-skinned):
 * a shift-progress bar fills from 06:00 to 18:00, the graphite overlay lifts
 * away, then the H1 rises by lines. Plays once per browser session and is
 * skipped with reduced motion. Without JS the overlay is hidden by CSS.
 */
export function ShiftIntro({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const overlay = el.querySelector<HTMLElement>('[data-overlay]');
    const bar = el.querySelector<HTMLElement>('[data-bar]');
    const clock = el.querySelector<HTMLElement>('[data-clock]');
    const heading = el.querySelector<HTMLElement>('[data-split]');
    if (!overlay || !bar || !heading) return;

    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      seen = false;
    }
    if (seen || prefersReducedMotion()) {
      overlay.style.display = 'none';
      return;
    }

    const { gsap, SplitText } = setupGsap();
    let split: InstanceType<typeof SplitText> | null = null;
    let tl: gsap.core.Timeline | null = null;
    let cancelled = false;

    document.fonts.ready.then(() => {
      if (cancelled) return;
      split = SplitText.create(heading, { type: 'lines', mask: 'lines', linesClass: 'intro-line' });
      gsap.set(split.lines, { yPercent: 110 });
      gsap.set(el.querySelectorAll('[data-fade]'), { opacity: 0 });

      const state = { t: 0 };
      tl = gsap.timeline();
      tl.to(bar, { scaleX: 1, duration: 1.1, ease: 'glide' }, 0);
      tl.to(
        state,
        {
          t: 1,
          duration: 1.1,
          ease: 'glide',
          onUpdate: () => {
            if (!clock) return;
            const minutes = 6 * 60 + Math.round(state.t * 12 * 60);
            clock.textContent = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
          },
        },
        0,
      );
      tl.to(
        overlay,
        { clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)', duration: 0.8, ease: 'hop' },
        '>0.15',
      );
      tl.to(split.lines, { yPercent: 0, duration: 0.9, ease: 'hop', stagger: 0.1 }, '<0.35');
      tl.to(
        el.querySelectorAll('[data-fade]'),
        { opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.08 },
        '<0.4',
      );
      tl.call(() => {
        overlay.style.display = 'none';
        try {
          sessionStorage.setItem(SEEN_KEY, '1');
        } catch {
          /* private mode: the intro will simply play again */
        }
      });
    });

    return () => {
      cancelled = true;
      tl?.kill();
      split?.revert();
      gsap.set(el.querySelectorAll('[data-fade]'), { clearProps: 'opacity' });
    };
  }, []);

  return (
    <div ref={root} className="intro-root">
      <noscript>
        <style>{`.intro-overlay{display:none !important}`}</style>
      </noscript>
      <div className="intro-overlay" data-overlay="" aria-hidden="true">
        <div className="intro-clock mono" data-clock="">
          06:00
        </div>
        <div className="intro-track">
          <div className="intro-bar" data-bar="" />
        </div>
        <div className="intro-ticks mono">
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
        </div>
      </div>
      {children}
    </div>
  );
}
