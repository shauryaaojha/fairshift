import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeedbackHeatmap } from '@/src/components/admin/FeedbackHeatmap';
import { buildHeatmapRows } from '@/src/server/services/adminRows';
import type { AggregatedFeedback } from '@/src/shared/types';

const avg = (n: number) => ({
  managerRespect: n,
  safetyRating: n,
  payFairness: n,
  workloadRating: n,
});

const data: AggregatedFeedback[] = [
  { team: 'Masonry', isoWeek: '2026-W43', count: 4, averages: avg(4.2), comments: null },
  { team: 'Electrical', isoWeek: '2026-W43', count: 2, averages: null, comments: null },
];

describe('FeedbackHeatmap', () => {
  it('shows scores for teams with at least 3 answers', () => {
    const { container } = render(<FeedbackHeatmap rows={buildHeatmapRows(data)} />);
    const cells = container.querySelectorAll('td[data-cell]');
    expect(cells).toHaveLength(4);
    expect(cells[0]).toHaveTextContent('4.2');
  });

  it('hides every cell for a team with fewer than 3 answers', () => {
    const { container } = render(<FeedbackHeatmap rows={buildHeatmapRows(data)} />);
    const hidden = container.querySelectorAll('td[data-hidden]');
    expect(hidden).toHaveLength(1);
    expect(hidden[0]).toHaveTextContent(/fewer than 3/i);
    expect(screen.getByText(/Electrical/)).toBeInTheDocument();
  });

  it('never reveals averages when count < k even if the backend sent them', () => {
    const leaky: AggregatedFeedback[] = [
      { team: 'Tiny', isoWeek: '2026-W43', count: 2, averages: avg(1.5), comments: null },
    ];
    const rows = buildHeatmapRows(leaky);
    expect(rows[0].hidden).toBe(true);
    expect(rows[0].cells.every((c) => c.value === null)).toBe(true);
    const { container } = render(<FeedbackHeatmap rows={rows} />);
    expect(container.textContent).not.toContain('1.5');
  });

  it('shows an empty message with no teams', () => {
    render(<FeedbackHeatmap rows={[]} />);
    expect(screen.getByText(/no feedback yet/i)).toBeInTheDocument();
  });
});
