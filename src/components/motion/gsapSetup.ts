'use client';

// One place that registers GSAP plugins and the two house easings
// (design-system.md section 6.3: hop and glide). Client-only.
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';

let ready = false;

export function setupGsap() {
  if (!ready) {
    gsap.registerPlugin(SplitText, CustomEase);
    CustomEase.create('hop', '0.9, 0, 0.1, 1');
    CustomEase.create('glide', '0.8, 0, 0.2, 1');
    ready = true;
  }
  return { gsap, SplitText };
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
