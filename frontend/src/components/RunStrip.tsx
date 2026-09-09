import { Card, CardContent } from '@/components/ui/card'
import type { AnalysisSummary, Diff } from '../types'

type RunStripProps = {
  kpis: Record<string, number> | undefined
  diff: Diff | undefined
  analyses: AnalysisSummary[] | undefined
  analysisId: number | null
  onSelectRun: (id: number) => void
}

const KPI_LABELS: Array<{ key: string; label: string; warn?: boolean }> = [
  { key: 'sites_total', label: 'Standorte' },
  { key: 'findings_total', label: 'Befunde' },
  { key: 'findings_critical', label: 'Kritisch', warn: true },
  { key: 'sites_with_sla_risk', label: 'SLA-Risiko', warn: true },
]

export function RunStrip({ kpis, diff, analyses, analysisId, onSelectRun }: RunStripProps) {
  if (!kpis) {
    return (
      <p className="text-sm text-muted-foreground">
        Analyse starten, um Workbooks in die Ausnahme-Warteschlange zu überführen.
      </p>
    )
  }

  return (
    <section className="space-y-3" aria-label="Lauf-Kennzahlen">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPI_LABELS.map(({ key, label, warn }) => (
          <Card key={key}>
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
              <p
                className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
                  warn ? 'text-[var(--warn)]' : 'text-foreground'
                }`}
              >
                {kpis[key] ?? '—'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 text-sm text-muted-foreground">
        {diff?.compared_to_run_id != null && (
          <p>
            Seit Lauf #{diff.compared_to_run_id}:{' '}
            <strong className="text-[var(--warn)]">{diff.new_count} neu</strong> ·{' '}
            <strong className="text-foreground">{diff.resolved_count} erledigt</strong> ·{' '}
            {diff.persisting_count} unverändert
          </p>
        )}
        {analyses && analyses.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="run-select" className="text-xs uppercase tracking-wider">
              Lauf
            </label>
            <select
              id="run-select"
              value={analysisId ?? ''}
              onChange={(e) => onSelectRun(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-card px-2 text-sm"
            >
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  #{a.id}
                  {a.created_at
                    ? ` · ${new Date(a.created_at).toLocaleString('de-DE', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : ''}
                  {a.kpis?.findings_critical != null
                    ? ` · ${a.kpis.findings_critical} kritisch`
                    : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </section>
  )
}
