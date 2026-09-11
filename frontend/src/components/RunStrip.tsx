import type { AnalysisSummary, Diff } from '@/types'

type RunStripProps = {
  kpis: Record<string, number> | undefined
  diff: Diff | undefined
  analyses: AnalysisSummary[] | undefined
  analysisId: number | null
  onSelectRun: (id: number) => void
}

export function RunStrip({ kpis, diff, analyses, analysisId, onSelectRun }: RunStripProps) {
  const totalSites = kpis?.sites_total ?? 0
  const critical = kpis?.findings_critical ?? 0
  const warnings = kpis?.findings_warning ?? 0
  const atRisk = kpis?.sites_with_sla_risk ?? critical
  const onPlanPercent =
    totalSites > 0
      ? Math.max(0, Math.round(((totalSites - atRisk) / totalSites) * 100))
      : 0
  const summary = [
    { label: 'Standorte', value: totalSites, tone: '' },
    { label: 'kritisch', value: critical, tone: 'text-[var(--critical)]' },
    { label: 'Warnungen', value: warnings, tone: 'text-[var(--warning)]' },
    { label: 'im Plan', value: `${onPlanPercent} %`, tone: 'text-[var(--success)]' },
  ]

  if (!kpis) {
    if (analysisId == null) {
      return (
        <p className="border-y border-border py-4 text-sm text-muted-foreground">
          Starten Sie eine Analyse, um Kennzahlen und Laufvergleiche zu sehen.
        </p>
      )
    }
    return (
      <div
        className="h-12 animate-pulse border-y border-border bg-muted/60"
        aria-label="Kennzahlen werden geladen"
      />
    )
  }

  return (
    <section
      aria-label="Lauf-Kennzahlen"
      className="flex min-h-12 flex-wrap items-center gap-x-5 gap-y-2 border-y border-border py-2.5"
    >
      <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2">
        {summary.map((metric) => (
          <div key={metric.label} className="flex items-baseline gap-1.5 whitespace-nowrap">
            <strong
              className={`font-mono text-base font-semibold tabular-nums ${metric.tone}`}
            >
              {metric.value}
            </strong>
            <span className="text-xs text-muted-foreground">{metric.label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          {diff?.compared_to_run_id != null
            ? `Gegen Lauf #${diff.compared_to_run_id}: ${diff.new_count} neu, ${diff.resolved_count} erledigt, ${diff.persisting_count} unverändert`
            : 'Erster Lauf oder kein Vergleich verfügbar'}
        </span>
        {analyses && analyses.length > 0 && (
          <label className="flex items-center gap-2">
            <span>Lauf</span>
            <select
              value={analysisId ?? ''}
              onChange={(event) => onSelectRun(Number(event.target.value))}
              className="h-7 rounded-md border border-input bg-[var(--surface-raised)] px-2 font-mono text-xs text-foreground"
            >
              {analyses.map((analysis) => (
                <option key={analysis.id} value={analysis.id}>
                  #{analysis.id}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </section>
  )
}
