import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttendanceChart, computeChart, formatDay } from '@/src/components/admin/AttendanceChart';

const days = [
  { date: '2026-10-25', present: 10, total: 20 },
  { date: '2026-10-26', present: 20, total: 20 },
  { date: '2026-10-27', present: 5, total: 20 },
];

describe('AttendanceChart', () => {
  it('renders one bar per day with the right data', () => {
    const { container } = render(<AttendanceChart days={days} />);
    const bars = container.querySelectorAll('rect[data-bar]');
    expect(bars).toHaveLength(3);
    expect(Array.from(bars).map((b) => b.getAttribute('data-present'))).toEqual(['10', '20', '5']);
  });

  it('scales bar heights in proportion to the present count', () => {
    const g = computeChart(days);
    const [a, b, c] = g.bars;
    expect(b.height).toBeGreaterThan(a.height);
    expect(a.height / b.height).toBeCloseTo(0.5, 5);
    expect(c.height / b.height).toBeCloseTo(0.25, 5);
    for (const bar of g.bars) expect(bar.y + bar.height).toBeCloseTo(g.plot.bottom, 5);
  });

  it('includes an accessible title and a table fallback with the same numbers', () => {
    render(<AttendanceChart days={days} />);
    expect(screen.getByRole('img', { name: /workers on site per day/i })).toBeInTheDocument();
    const table = screen.getByRole('table', { hidden: true });
    expect(table.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(table).toHaveTextContent('26 Oct');
  });

  it('handles an empty series without crashing', () => {
    const { container } = render(<AttendanceChart days={[]} />);
    expect(container.querySelectorAll('rect[data-bar]')).toHaveLength(0);
  });

  it('formats day labels', () => {
    expect(formatDay('2026-10-05')).toBe('5 Oct');
  });
});
