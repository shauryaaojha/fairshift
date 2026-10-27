import type { HazardRow } from '@/src/server/services/adminViews';
import { StatusStamp, SEVERITY_ORDER } from './StatusStamp';
import { fmtDateTime } from './format';
import { acknowledgeAction, confirmSeverityAction, resolveAction } from '@/app/admin/actions';

/**
 * One hazard in the safety queue: SLA timer, original report, English AI
 * summary, AI severity suggestion that the admin confirms, and the actions.
 */
export function HazardCard({ h }: { h: HazardRow }) {
  const late = h.liveStatus === 'escalated';
  const suggestion = h.aiSuggestedSeverity;
  const differs = suggestion !== null && suggestion !== h.severity;

  return (
    <li className="hazard">
      <div className="hazard-top">
        <h2>{h.category}</h2>
        <StatusStamp status={h.liveStatus} id={h.id} />
      </div>
      <p className="text-small muted">
        <span className="mono">{h.severity}</span> severity · reported{' '}
        <span className="mono">{fmtDateTime(h.reportedAt)}</span> ·{' '}
        {h.anonymous ? 'anonymous' : 'named reporter'}
      </p>
      <p>{h.description}</p>

      <p className="sla" data-late={late || undefined}>
        {h.slaLabel}
      </p>

      {h.aiSummary && (
        <div className="ai-note">
          <p className="ai-label">Explained by AI · check with supervisor</p>
          <p>
            <strong>English summary:</strong> {h.aiSummary}
          </p>
          {h.liveStatus !== 'resolved' && (
            <form action={confirmSeverityAction} className="inline-form">
              <input type="hidden" name="id" value={h.id} />
              <label htmlFor={`sev-${h.id}`} className="text-small">
                {differs ? `AI suggests ${suggestion}. Severity:` : 'Severity:'}
              </label>
              <select
                id={`sev-${h.id}`}
                name="severity"
                defaultValue={suggestion ?? h.severity}
                className="btn-quiet btn-small"
              >
                {SEVERITY_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-quiet btn-small">
                Confirm severity
              </button>
            </form>
          )}
        </div>
      )}

      {h.liveStatus !== 'resolved' && (
        <div className="inline-form">
          {!h.acknowledgedAt && (
            <form action={acknowledgeAction}>
              <input type="hidden" name="id" value={h.id} />
              <button type="submit" className="btn-primary btn-small">
                Acknowledge
              </button>
            </form>
          )}
          <form action={resolveAction}>
            <input type="hidden" name="id" value={h.id} />
            <button type="submit" className="btn-quiet btn-small">
              Mark resolved
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
