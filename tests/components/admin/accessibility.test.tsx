import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { FeedbackHeatmap, cellStyle } from '@/src/components/admin/FeedbackHeatmap';
import { StateSentence } from '@/src/components/admin/StateSentence';
import { RiskTable } from '@/src/components/admin/RiskTable';
import { Attendance } from '@/app/admin/(console)/attendance/page';
import type * as AdminPages from '@/src/server/services/adminPages';
import { buildHeatmapRows, type RiskRow } from '@/src/server/services/adminRows';
import type { AggregatedFeedback } from '@/src/shared/types';

// Setup window.matchMedia for JSDOM
beforeAll(() => {
  if (typeof window !== 'undefined' && !window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true, // prefers-reduced-motion to disable GSAP in tests
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
});

// Mock server context and data for Attendance page test
vi.mock('@/app/admin/_lib/context', () => ({
  getAdminContext: vi.fn().mockResolvedValue({
    userId: 'admin-1',
    orgId: 'org-construction',
    sector: { key: 'construction', label: 'Construction', place: 'Skyline Towers' },
    allowedSectors: ['construction'],
  }),
}));

vi.mock('@/src/server/services/adminPages', async (importOriginal) => {
  const actual = await importOriginal<typeof AdminPages>();
  return {
    ...actual,
    getAttendanceData: vi.fn().mockResolvedValue({
      rows: [
        {
          shiftId: 'shift-1',
          workerName: 'Aarav Sharma',
          team: 'Masonry',
          checkIn: '2026-10-27T08:00:00Z',
          checkOut: '2026-10-27T16:00:00Z',
          hours: 8,
          method: 'QR',
          onSite: false,
        },
      ],
      teams: ['Masonry'],
      trend: [],
    }),
  };
});

/** WCAG 2.1 relative luminance calculation */
function srgbLuminance(r: number, g: number, b: number): number {
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG 2.1 contrast ratio calculation */
function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = srgbLuminance(...rgb1);
  const l2 = srgbLuminance(...rgb2);
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

describe('Admin Accessibility Enhancements', () => {
  describe('Feedback Heatmap Color Contrast (item 1)', () => {
    it('meets WCAG AA (>= 4.5:1) color contrast across all 5 discrete rating steps', () => {
      // Design system tokens:
      // --ink: #1F3FB5 (rgb 31, 63, 181)
      // white: #FFFFFF (rgb 255, 255, 255)
      // --graphite: #1C1D1A (rgb 28, 29, 26)
      const inkRgb = [31, 63, 181];
      const whiteRgb: [number, number, number] = [255, 255, 255];
      const graphiteRgb: [number, number, number] = [28, 29, 26];

      for (let score = 1; score <= 5; score++) {
        const style = cellStyle(score);
        expect(style.background).toBeDefined();
        expect(style.color).toBeDefined();

        // Extract ink mix percentage: color-mix(in srgb, var(--ink) {pct}%, white)
        const match = style.background.match(/var\(--ink\)\s+(\d+)%/);
        expect(match).not.toBeNull();
        const pct = parseInt(match![1], 10);

        // Compute mixed background RGB
        const bgRgb: [number, number, number] = [
          Math.round((inkRgb[0] * pct + whiteRgb[0] * (100 - pct)) / 100),
          Math.round((inkRgb[1] * pct + whiteRgb[1] * (100 - pct)) / 100),
          Math.round((inkRgb[2] * pct + whiteRgb[2] * (100 - pct)) / 100),
        ];

        // Resolve text color
        const isWhite =
          style.color.toLowerCase() === '#ffffff' || style.color.toLowerCase() === '#fff';
        const textRgb = isWhite ? whiteRgb : graphiteRgb;

        const ratio = contrastRatio(bgRgb, textRgb);
        // WCAG AA requirement for normal text is >= 4.5:1
        expect(ratio).toBeGreaterThanOrEqual(4.5);

        if (score === 5) {
          expect(style.color.toLowerCase()).toBe('#ffffff');
        } else {
          expect(style.color).toBe('var(--graphite)');
        }
      }
    });

    it('renders heatmap with accessible region attributes', () => {
      const data: AggregatedFeedback[] = [
        {
          team: 'Masonry',
          isoWeek: '2026-W43',
          count: 4,
          averages: {
            managerRespect: 4.2,
            safetyRating: 4.8,
            payFairness: 4.0,
            workloadRating: 4.1,
          },
          comments: null,
        },
      ];
      render(<FeedbackHeatmap rows={buildHeatmapRows(data)} k={3} />);
      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
      expect(region).toHaveAttribute('tabIndex', '0');
      expect(region).toHaveAttribute('aria-label');
    });
  });

  describe('State Sentence Link Distinction (item 2)', () => {
    it('ensures links in state sentence have visible underline styling and classes', () => {
      const segments = [
        { text: '43 of 51 on site', href: '/admin/attendance' },
        { text: ' · 2 hazards escalated', href: '/admin/safety' },
        { text: ' · all clear' },
      ];
      render(<StateSentence segments={segments} />);
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(2);
      links.forEach((link) => {
        expect(link.className).toContain('state-link');
        expect(link.className).toContain('underline');
        expect(link.className).toContain('decoration-2');
        expect(link.className).toContain('underline-offset-4');
      });
    });
  });

  describe('Scrollable Table Focusability (item 3)', () => {
    it('ensures RiskTable .table-wrap has tabIndex, role region, and aria-label', () => {
      const rows: RiskRow[] = [
        {
          id: 'w-1',
          name: 'Ramesh Kumar',
          team: 'Masonry',
          orgId: 'org-construction',
          siteId: 'site-1',
          phone: '9876543210',
          role: 'mason',
          locale: 'hi',
          basePay: 800,
          allowances: 0,
          payType: 'daily',
          active: true,
          risk: {
            score: 72,
            topReasons: [{ factor: 'fatigue', weight: 40, detail: 'Consecutive shifts' }],
          },
        },
      ];
      const caption = 'Quit-risk score and top reasons per worker';
      render(<RiskTable rows={rows} caption={caption} />);
      const region = screen.getByRole('region', { name: caption });
      expect(region).toBeInTheDocument();
      expect(region).toHaveAttribute('tabIndex', '0');
      expect(region).toHaveAttribute('aria-label', caption);
    });

    it('ensures Attendance table-wrap has tabIndex, role region, and aria-label', async () => {
      const attendanceEl = await Attendance({ searchParams: Promise.resolve({}) });
      render(attendanceEl);
      const region = screen.getByRole('region', { name: 'Shifts in the last 14 days' });
      expect(region).toBeInTheDocument();
      expect(region).toHaveAttribute('tabIndex', '0');
      expect(region).toHaveAttribute('aria-label', 'Shifts in the last 14 days');
    });
  });
});
