import type { ExplainResult, Finding, Timeline } from '../types'

type InspectorProps = {
  selected: Finding | null
  timeline: Timeline | undefined
  explainPending: boolean
  reviewPending: boolean
  reviewClosed: boolean
  reviewError: boolean
  reviewSuccess: boolean
  explainResult: ExplainResult | undefined
  onExplain: () => void
  onApprove: () => void
  onDismiss: () => void
}

function formatTimelineValue(value: string | null) {
  return value ?? 'n/a'
}

export function Inspector({
  selected,
  timeline,
  explainPending,
  reviewPending,
  reviewClosed,
  reviewError,
  reviewSuccess,
  explainResult,
  onExplain,
  onApprove,
  onDismiss,
}: InspectorProps) {
  return (
    <aside className="inspector-panel" aria-label="Evidence inspector">
      <div className="panel-head">
        <h2>Inspector</h2>
      </div>
      <div className="inspector-body">
        {!selected && (
          <p className="muted">Select a finding to inspect lineage and review.</p>
        )}
        {selected && (
          <>
            <div className="inspector-header">
              <p className="eyebrow">
                {selected.rule_id} · {selected.site_id}
              </p>
              <p>
                <span className={`review-status ${selected.status}`}>{selected.status}</span>
              </p>
              <p className="inspector-message">{selected.message}</p>
              <div className="inspector-actions">
                <button type="button" onClick={onExplain} disabled={explainPending}>
                  {explainPending ? 'Explaining…' : 'AI explain'}
                </button>
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={reviewPending || reviewClosed}
                >
                  {reviewPending ? 'Saving…' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={onDismiss}
                  disabled={reviewPending || reviewClosed}
                >
                  Dismiss
                </button>
              </div>
              {reviewError && (
                <p className="warn status-inline">Could not save review. Is the API running?</p>
              )}
              {reviewSuccess && reviewClosed && (
                <p className="muted status-inline">Review saved ({selected.status}).</p>
              )}
              {explainResult && (
                <div className="ai-box">
                  <h3>AI explanation</h3>
                  <p>{explainResult.explanation.summary}</p>
                  {explainResult.explanation.proposed_next_action && (
                    <p>
                      <strong>Next:</strong> {explainResult.explanation.proposed_next_action}
                    </p>
                  )}
                  <p className="muted">
                    category={explainResult.explanation.blocker_category ?? 'n/a'} ·
                    confidence={explainResult.explanation.confidence} ·
                    abstained={String(explainResult.explanation.abstained)}
                  </p>
                </div>
              )}
            </div>

            <div className="evidence-surface">
              <h3>Source cells</h3>
              <ul className="evidence-list">
                {selected.evidence.map((e) => (
                  <li key={e.evidence_id}>
                    <code>{e.evidence_id}</code>{' '}
                    {e.file} / {e.sheet} r{e.row} · {e.column}
                    {e.value != null && (
                      <span className="cell-value"> = {e.value}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {timeline && (
              <div className="evidence-surface">
                <h3>Site timeline</h3>
                <dl className="timeline">
                  {Object.entries(timeline.timeline).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{formatTimelineValue(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

          </>
        )}
      </div>
    </aside>
  )
}
