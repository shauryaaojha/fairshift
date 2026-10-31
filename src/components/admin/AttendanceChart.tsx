import type { DailyAttendance } from '@/src/shared/types';

export interface Bar {
  date: string;
  present: number;
  total: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface ChartGeometry {
  width: number;
  height: number;
  plot: { left: number; top: number; right: number; bottom: number };
  max: number;
  ticks: { value: number; y: number }[];
  bars: Bar[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDay(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ''}`;
}

/** Pure layout: the same numbers drive the SVG, the table fallback and the tests. */
export function computeChart(days: DailyAttendance[], width = 640, height = 240): ChartGeometry {
  const plot = { left: 40, top: 16, right: width - 8, bottom: height - 32 };
  const innerW = plot.right - plot.left;
  const innerH = plot.bottom - plot.top;
  const rawMax = Math.max(1, ...days.map((d) => Math.max(d.present, d.total)));
  const step = rawMax <= 10 ? 2 : rawMax <= 40 ? 10 : rawMax <= 100 ? 20 : 50;
  const max = Math.ceil(rawMax / step) * step;
  const slot = days.length > 0 ? innerW / days.length : innerW;
  const barW = Math.max(4, slot * 0.62);

  const bars: Bar[] = days.map((d, i) => {
    const h = (d.present / max) * innerH;
    return {
      date: d.date,
      present: d.present,
      total: d.total,
      x: plot.left + i * slot + (slot - barW) / 2,
      y: plot.bottom - h,
      width: barW,
      height: h,
      label: formatDay(d.date),
    };
  });

  const ticks: { value: number; y: number }[] = [];
  for (let v = 0; v <= max; v += step) {
    ticks.push({ value: v, y: plot.bottom - (v / max) * innerH });
  }

  return { width, height, plot, max, ticks, bars };
}

/**
 * Hand-built SVG, no chart library. One series (workers present per day);
 * the dashed rule is the roster size. The table below is the accessible
 * fallback with the same numbers.
 */
export function AttendanceChart({ days }: { days: DailyAttendance[] }) {
  const g = computeChart(days);
  const roster = days[0]?.total ?? 0;
  const rosterY = g.plot.bottom - (roster / g.max) * (g.plot.bottom - g.plot.top);
  const last = g.bars[g.bars.length - 1];

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${g.width} ${g.height}`}
        role="img"
        aria-labelledby="att-title att-desc"
        className="chart-svg"
      >
        {/* One string: React treats <title> children specially and a mixed array breaks hydration. */}
        <title id="att-title">{`Workers on site per day, last ${days.length} days`}</title>
        <desc id="att-desc">
          {days.length > 0
            ? `From ${formatDay(days[0].date)} to ${formatDay(days[days.length - 1].date)}. Roster of ${roster}. Latest day: ${last?.present ?? 0} present.`
            : 'No attendance recorded.'}
        </desc>

        {g.ticks.map((t) => (
          <g key={t.value}>
            <line
              x1={g.plot.left}
              x2={g.plot.right}
              y1={t.y}
              y2={t.y}
              stroke="var(--rule)"
              strokeWidth={1}
            />
            <text x={g.plot.left - 8} y={t.y + 4} textAnchor="end" className="chart-axis">
              {t.value}
            </text>
          </g>
        ))}

        {roster > 0 && (
          <line
            x1={g.plot.left}
            x2={g.plot.right}
            y1={rosterY}
            y2={rosterY}
            stroke="var(--graphite)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        )}

        {g.bars.map((b, i) => (
          <g key={b.date}>
            <rect
              data-bar=""
              data-date={b.date}
              data-present={b.present}
              x={b.x}
              y={b.y}
              width={b.width}
              height={b.height}
              fill="var(--ink)"
            >
              <title>{`${b.label}: ${b.present} of ${b.total} present`}</title>
            </rect>
            {i % 2 === (g.bars.length - 1) % 2 && (
              <text
                x={b.x + b.width / 2}
                y={g.plot.bottom + 18}
                textAnchor="middle"
                className="chart-axis"
              >
                {b.label}
              </text>
            )}
          </g>
        ))}

        {last && (
          <text
            x={last.x + last.width / 2}
            y={Math.max(12, last.y - 6)}
            textAnchor="middle"
            className="chart-value"
          >
            {last.present}
          </text>
        )}
      </svg>
      <figcaption className="text-small chart-legend">
        <span className="legend-swatch" aria-hidden="true" /> Present
        <span className="legend-dash" aria-hidden="true" /> Roster ({roster})
      </figcaption>
      <table className="sr-only">
        <caption>Workers on site per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Present</th>
            <th scope="col">Roster</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{formatDay(d.date)}</th>
              <td>{d.present}</td>
              <td>{d.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
