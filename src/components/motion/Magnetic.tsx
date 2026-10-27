'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { prefersReducedMotion, setupGsap } from './gsapSetup';

/**
 * Pulls its content a few pixels toward the pointer. Desktop only
 * (pointer: fine), capped at 6 px, off with reduced motion.
 */
export function Magnetic({ children, max = 6 }: { children: ReactNode; max?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return;
    const { gsap } = setupGsap();
    const cap = Math.min(max, 6);
    const clamp = gsap.utils.clamp(-cap, cap);

    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      gsap.to(el, {
        x: clamp(dx * cap),
        y: clamp(dy * cap),
        duration: 0.25,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    };
    const leave = () =>
      gsap.to(el, { x: 0, y: 0, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      gsap.killTweensOf(el);
    };
  }, [max]);

  return (
    <span ref={ref} style={{ display: 'inline-block' }}>
      {children}
    </span>
  );
}
