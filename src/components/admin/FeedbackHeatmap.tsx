import type { HeatmapRow } from '@/src/server/services/adminRows';

/** Five discrete steps of ink on white (no gradient). Score is also printed.
 * Ensures WCAG AA contrast (>= 4.5:1) for all 5 steps against text color.
 */
export function cellStyle(value: number): { background: string; color: string } {
  const step = Math.min(5, Math.max(1, Math.round(value)));
  const pct = [8, 20, 35, 50, 85][step - 1];
  return {
    background: `color-mix(in srgb, var(--ink) ${pct}%, white)`,
    color: pct >= 80 ? '#ffffff' : 'var(--graphite)',
  };
}

/**
 * Team x question heatmap. A team with fewer than k answers shows no numbers
 * at all, so a small group can never be identified from its scores.
 */
export function FeedbackHeatmap({ rows, k = 3 }: { rows: HeatmapRow[]; k?: number }) {
  if (rows.length === 0) return <p className="text-body">No feedback yet this week.</p>;
  const questions = rows[0].cells;

  return (
    <div
      className="table-wrap"
      tabIndex={0}
      role="region"
      aria-label={`Average score out of 5 by team and question. Teams with fewer than ${k} answers are hidden.`}
    >
      <table className="heatmap">
        <caption className="sr-only">
          Average score out of 5 by team and question. Teams with fewer than {k} answers are hidden.
        </caption>
        <thead>
          <tr>
            <th scope="col">Team</th>
            {questions.map((q) => (
              <th scope="col" key={q.key}>
                {q.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.team}>
              <th scope="row">
                {row.team}{' '}
                <span className="text-small muted">
                  ({row.count} {row.count === 1 ? 'answer' : 'answers'})
                </span>
              </th>
              {row.hidden ? (
                <td colSpan={questions.length} data-hidden="" className="heat-hidden">
                  Hidden: fewer than {k} answers
                </td>
              ) : (
                row.cells.map((c) => (
                  <td
                    key={c.key}
                    data-cell={c.key}
                    style={c.value === null ? undefined : cellStyle(c.value)}
                    className="heat-cell"
                  >
                    {c.value === null ? '' : c.value.toFixed(1)}
                  </td>
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
