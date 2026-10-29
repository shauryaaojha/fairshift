import type { RiskRow } from '@/src/server/services/adminRows';
import { RiskStamp } from './StatusStamp';

/** Quit-risk table: score, status stamp and the top reasons behind it. */
export function RiskTable({ rows, caption }: { rows: RiskRow[]; caption: string }) {
  if (rows.length === 0) return <p className="text-body">No workers match this filter.</p>;
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Worker</th>
            <th scope="col">Team</th>
            <th scope="col" className="num">
              Score
            </th>
            <th scope="col">Level</th>
            <th scope="col">Top reasons</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row">{r.name}</th>
              <td>{r.team}</td>
              <td className="num">{r.risk.score}</td>
              <td>
                <RiskStamp score={r.risk.score} id={r.id} />
              </td>
              <td className="wrap">
                <ol className="reasons">
                  {r.risk.topReasons.map((t) => (
                    <li key={t.factor}>{t.detail}</li>
                  ))}
                </ol>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
