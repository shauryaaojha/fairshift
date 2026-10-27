'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { TransitionRouter } from 'next-transition-router';
import { prefersReducedMotion, setupGsap } from './gsapSetup';

const CELL = 48;

/**
 * Register-cell block transition (login -> workspace).
 * A grid of paper cells with register-rule borders fills in, the route
 * changes, then the cells clear. Opt-in: only navigations made with
 * useTransitionRouter().push play it. Total about 700 ms.
 */
export function TransitionProvider({ children }: { children: ReactNode }) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const cellsRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const build = () => {
      const grid = gridRef.current;
      if (!grid) return;
      grid.replaceChildren();
      cellsRef.current = [];
      const cols = Math.ceil(window.innerWidth / CELL);
      const rows = Math.ceil(window.innerHeight / CELL);
      grid.style.gridTemplateColumns = `repeat(${cols}, ${CELL}px)`;
      grid.style.gridAutoRows = `${CELL}px`;
      for (let i = 0; i < cols * rows; i++) {
        const c = document.createElement('div');
        c.className = 'register-cell';
        c.style.opacity = '0';
        grid.appendChild(c);
        cellsRef.current.push(c);
      }
    };
    build();
    window.addEventListener('resize', build);
    return () => window.removeEventListener('resize', build);
  }, []);

  return (
    <TransitionRouter
      leave={(next) => {
        if (prefersReducedMotion()) {
          next();
          return;
        }
        const { gsap } = setupGsap();
        const tween = gsap.to(cellsRef.current, {
          opacity: 1,
          duration: 0.08,
          ease: 'power2.inOut',
          stagger: { amount: 0.3, from: 'random' },
          onComplete: next,
        });
        return () => {
          tween.kill();
        };
      }}
      enter={(next) => {
        if (prefersReducedMotion()) {
          next();
          return;
        }
        const { gsap } = setupGsap();
        gsap.set(cellsRef.current, { opacity: 1 });
        const tween = gsap.to(cellsRef.current, {
          opacity: 0,
          duration: 0.08,
          delay: 0.1,
          ease: 'power2.inOut',
          stagger: { amount: 0.3, from: 'random' },
          onComplete: next,
        });
        return () => {
          tween.kill();
        };
      }}
    >
      <div ref={gridRef} className="register-grid" aria-hidden="true" />
      {children}
    </TransitionRouter>
  );
}
