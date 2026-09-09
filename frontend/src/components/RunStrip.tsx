import type { AnalysisSummary, Diff } from '../types'

type RunStripProps = {
  kpis: Record<string, number> | undefined
  diff: Diff | undefined
  analyses: AnalysisSummary[] | undefined
  analysisId: number | null
  onSelectRun: (id: number) => void
}

export function RunStrip({ kpis, diff, analyses, analysisId, onSelectRun }: RunStripProps) {
  if (!kpis) {
    return (
      <section className="run-strip" aria-label="Run summary">
        <p className="run-strip-summary muted">
          Run analysis to reconcile workbooks into the exception queue.
        </p>
      </section>
    )
  }

  const diffPart =
    diff?.compared_to_run_id != null
      ? ` · +${diff.new_count} new vs run ${diff.compared_to_run_id}, ${diff.resolved_count} resolved`
      : ''

  return (
    <section className="run-strip" aria-label="Run summary">
      <p className="run-strip-summary">
        <strong>{kpis.sites_total}</strong> sites,{' '}
        <strong>{kpis.findings_total}</strong> findings,{' '}
        <strong className="critical-count">{kpis.findings_critical}</strong> critical,{' '}
        <strong>{kpis.sites_with_sla_risk}</strong> SLA risk{diffPart}.
      </p>
      {analyses && analyses.length > 1 && (
        <div className="run-strip-controls">
          <label htmlFor="run-select">Run</label>
          <select
            id="run-select"
            value={analysisId ?? ''}
            onChange={(e) => onSelectRun(Number(e.target.value))}
          >
            {analyses.map((a) => (
              <option key={a.id} value={a.id}>
                #{a.id}
                {a.created_at
                  ? ` · ${new Date(a.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : ''}
                {a.kpis?.findings_critical != null
                  ? ` · ${a.kpis.findings_critical} critical`
                  : ''}
              </option>
            ))}
          </select>
        </div>
      )}
    </section>
  )
}
