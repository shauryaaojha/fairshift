import type { CSSProperties } from 'react';
import type { HazardTimeline as Timeline } from '@/src/server/services/workerViews';

const ROW = 76;
const X = 16;

/**
 * A vertical register line drawn from Reported to the last reached step with
 * CSS stroke-dashoffset. An escalated or reopened node pulses once. Every node also has
 * a word label, so colour is never the only cue.
 */
export function HazardTimelineView({
  steps,
  labels,
  times,
}: {
  steps: Timeline['steps'];
  labels: Record<string, string>;
  /** Preformatted time per step key, if known. */
  times: Partial<Record<string, string>>;
}) {
  const lastDone = steps.reduce((acc, s, i) => (s.done ? i : acc), 0);
  const height = steps.length * ROW;
  const y = (i: number) => i * ROW + ROW / 2;

  return (
    <div className="relative" style={{ minHeight: height }}>
      <svg
        width={32}
        height={height}
        viewBox={`0 0 32 ${height}`}
        className="absolute left-0 top-0"
        aria-hidden="true"
      >
        {/* The road still to travel */}
        <path
          d={`M${X} ${y(0)} V${y(steps.length - 1)}`}
          stroke="var(--rule)"
          strokeWidth={4}
          strokeDasharray="2 8"
          strokeLinecap="round"
          fill="none"
        />
        {/* The road already travelled, drawn in */}
        {lastDone > 0 ? (
          <path
            d={`M${X} ${y(0)} V${y(lastDone)}`}
            pathLength={1}
            className="draw-path"
            style={{ '--path-length': 1 } as CSSProperties}
            stroke="var(--graphite)"
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
        {steps.map((s, i) => {
          const escalated = s.key === 'escalated' || s.key === 'reopened';
          const color = escalated
            ? 'var(--escalated)'
            : s.key === 'resolved' || s.key === 'confirmed'
              ? 'var(--cleared)'
              : 'var(--ink)';
          return (
            <g key={s.key}>
              {escalated ? (
                <circle
                  className="node-pulse"
                  cx={X}
                  cy={y(i)}
                  r={9}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                />
              ) : null}
              <circle
                cx={X}
                cy={y(i)}
                r={10}
                fill={s.done ? color : 'var(--card)'}
                stroke={s.done ? 'var(--graphite)' : 'var(--muted)'}
                strokeWidth={2}
              />
              {s.done ? (
                <path
                  d={`M${X - 4.5} ${y(i)} l3.2 3.2 l5.8 -6.4`}
                  stroke="#fff"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <ol className="m-0 list-none p-0">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center pl-12" style={{ height: ROW }}>
            <div className="min-w-0">
              <p className={'text-body ' + (s.done ? 'font-semibold' : 'text-muted')}>
                {labels[s.key]}
              </p>
              {times[s.key] ? <p className="text-mono text-muted">{times[s.key]}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
