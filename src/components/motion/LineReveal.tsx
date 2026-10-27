'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { prefersReducedMotion, setupGsap } from './gsapSetup';

/**
 * Heading that rises into view by LINES (SplitText type "lines" with a mask).
 * Never split by characters: that breaks Devanagari and Tamil. Plays once,
 * the first time the heading is visible. With reduced motion it is static.
 */
export function LineReveal({
  as: Tag = 'h2',
  className,
  children,
  immediate = false,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  /** Play on mount instead of waiting for the heading to scroll into view */
  immediate?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const { gsap, SplitText } = setupGsap();
    let tween: gsap.core.Tween | null = null;
    let split: InstanceType<typeof SplitText> | null = null;
    let observer: IntersectionObserver | null = null;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'reveal-line' });
      tween = gsap.from(split.lines, { yPercent: 110, duration: 0.8, ease: 'hop', stagger: 0.08 });
    };

    document.fonts.ready.then(() => {
      if (cancelled) return;
      if (immediate) {
        run();
      } else {
        observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
              observer?.disconnect();
              run();
            }
          },
          { threshold: 0.2 },
        );
        observer.observe(el);
      }
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      tween?.kill();
      split?.revert();
    };
  }, [immediate]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
