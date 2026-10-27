import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HazardTimelineView } from '@/src/components/worker/HazardTimeline';

const labels = {
  reported: 'Reported',
  escalated: 'Sent to the manager',
  acknowledged: 'Seen by supervisor',
  resolved: 'Fixed',
};

describe('HazardTimelineView', () => {
  it('names every step in words and draws the travelled line', () => {
    const { container } = render(
      <HazardTimelineView
        steps={[
          { key: 'reported', at: 'x', done: true },
          { key: 'acknowledged', at: 'y', done: true },
          { key: 'resolved', at: null, done: false },
        ]}
        labels={labels}
        times={{ reported: '27 Oct 08:00' }}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Seen by supervisor')).toBeInTheDocument();
    expect(screen.getByText('27 Oct 08:00')).toBeInTheDocument();
    expect(container.querySelectorAll('path.draw-path')).toHaveLength(1);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('pulses only the escalated node, once', () => {
    const { container } = render(
      <HazardTimelineView
        steps={[
          { key: 'reported', at: 'x', done: true },
          { key: 'escalated', at: null, done: true },
          { key: 'acknowledged', at: null, done: false },
          { key: 'resolved', at: null, done: false },
        ]}
        labels={labels}
        times={{}}
      />,
    );
    expect(container.querySelectorAll('.node-pulse')).toHaveLength(1);
  });
});
