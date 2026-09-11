import { RunStrip } from '@/components/RunStrip'
import { useWorkbench } from '@/context/workbench'
import { analysisStatusLabel } from '@/lib/labels'

export function RunsPage() {
  const workbench = useWorkbench()
  return (
    <div className="space-y-5">
      <header>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Analyse · Verlauf</p>
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em]">Läufe</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Historie, Vergleich und aktive Analyseauswahl.</p>
      </header>
      <RunStrip
        kpis={workbench.kpis}
        diff={workbench.diff}
        analyses={workbench.analyses}
        analysisId={workbench.analysisId}
        onSelectRun={workbench.onSelectRun}
      />
      <section className="overflow-hidden border border-border bg-[var(--surface-raised)]" aria-label="Analysehistorie">
        {workbench.analysesLoading && (
          <div className="m-4 h-14 animate-pulse bg-muted" aria-label="Analysehistorie wird geladen" />
        )}
        {workbench.analysesError && (
          <div className="flex items-center justify-between gap-3 px-4 py-6 text-sm text-[var(--critical)]">
            <span>Analysehistorie konnte nicht geladen werden.</span>
            <button className="font-medium text-primary hover:underline" onClick={workbench.retryAnalyses}>Wiederholen</button>
          </div>
        )}
        {!workbench.analysesLoading && !workbench.analysesError && (workbench.analyses ?? []).length === 0 && (
          <p className="px-4 py-8 text-sm text-muted-foreground">Noch keine Analyse-Läufe vorhanden.</p>
        )}
        {!workbench.analysesLoading && !workbench.analysesError && (workbench.analyses ?? []).length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr><th className="px-4 py-2.5">Lauf</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Zeitpunkt</th><th className="px-4 py-2.5">Kritisch</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(workbench.analyses ?? []).map((analysis) => (
              <tr key={analysis.id} className={analysis.id === workbench.analysisId ? 'bg-[var(--selection)]' : ''}>
                <td className="px-4 py-3"><button className="font-mono font-medium text-primary hover:underline" onClick={() => workbench.onSelectRun(analysis.id)}>#{analysis.id}</button></td>
                <td className="px-4 py-3">{analysisStatusLabel(analysis.status)}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{analysis.created_at ? new Date(analysis.created_at).toLocaleString('de-DE') : 'k. A.'}</td>
                <td className="px-4 py-3 font-mono text-[var(--critical)]">{analysis.kpis.findings_critical ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </section>
    </div>
  )
}
