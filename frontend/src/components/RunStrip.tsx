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
  const metrics = [
    { label: 'Standorte', value: totalSites, tone: '' },
    { label: 'kritisch', value: critical, tone: 'text-[var(--critical)]' },
    { label: 'Warnungen', value: warnings, tone: 'text-[var(--warning)]' },
    { label: 'im Plan', value: `${onPlanPercent} %`, tone: '' },
  ]

  if (!kpis) {
    if (analysisId == null) {
      return (
        <p className="border border-border bg-[var(--surface-raised)] px-4 py-6 text-sm text-muted-foreground">
          Starten Sie eine Analyse, um Kennzahlen und Laufvergleiche zu sehen.
        </p>
      )
    }
    return (
      <div
        className="h-[74px] animate-pulse border border-border bg-muted/60"
        aria-label="Kennzahlen werden geladen"
      />
    )
  }

  return (
    <section
      aria-label="Lauf-Kennzahlen"
      className="border border-border bg-[var(--surface-raised)]"
    >
      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex min-h-[72px] items-baseline gap-2 px-4 py-4">
            <strong
              className={`font-mono text-2xl font-semibold tabular-nums ${metric.tone}`}
            >
              {metric.value}
            </strong>
            <span className="text-xs text-muted-foreground">{metric.label}</span>
          </div>
        ))}
      </div>
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
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
              className="h-7 rounded-md border border-input bg-background px-2 font-mono text-xs text-foreground"
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
