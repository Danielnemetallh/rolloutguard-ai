import { Link, useSearchParams } from 'react-router-dom'
import { Play, Upload } from 'lucide-react'
import { KpiStrip } from '@/components/KpiStrip'
import { PageHeader } from '@/components/PageHeader'
import { Queue } from '@/components/Queue'
import { RunFooter } from '@/components/RunFooter'
import { Button } from '@/components/ui/button'
import { useWorkbench } from '@/context/WorkbenchContext'
import { useSelectedTimeline } from '@/hooks/useSelectedTimeline'
import { timelineLabel } from '@/lib/labels'

type LeitstandProps = {
  theme: 'dark' | 'light'
  onThemeToggle: () => void
  agentOpen: boolean
  onAgentToggle: () => void
}

export function Leitstand({ theme, onThemeToggle, agentOpen, onAgentToggle }: LeitstandProps) {
  const wb = useWorkbench()
  const [params, setParams] = useSearchParams()
  const selectedId = Number(params.get('befund')) || null
  const selected = wb.findings.find((f) => f.id === selectedId) ?? null
  const timeline = useSelectedTimeline(selected, wb.analysisId)

  const selectFinding = (id: number) => {
    const next = new URLSearchParams(params)
    next.set('befund', String(id))
    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leitstand"
        description="Priorisierte Abweichungen aus Vertrag, Terminplan und Standortstatus."
        theme={theme}
        onThemeToggle={onThemeToggle}
        agentOpen={agentOpen}
        agentPending={wb.askPending}
        onAgentToggle={onAgentToggle}
        actions={
          <>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={!wb.projectId || wb.analyzePending}
              onClick={wb.onAnalyze}
            >
              <Play className="size-4" />
              {wb.analyzePending ? 'Analysiere…' : 'Analyse starten'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!wb.analysisId || wb.exportPending}
              onClick={wb.onExport}
            >
              <Upload className="size-4" />
              Export
            </Button>
          </>
        }
      />

      <section className="border border-border bg-[var(--surface-raised)]">
        <KpiStrip kpis={wb.kpis} />
        <RunFooter
          diff={wb.diff}
          analyses={wb.analyses}
          analysisId={wb.analysisId}
          onSelectRun={wb.onSelectRun}
        />
      </section>

      {wb.draftCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {wb.draftCount} offene Entwürfe.{' '}
          <Link to="/aktionen" className="text-primary no-underline hover:underline">
            Aktionsqueue öffnen
          </Link>
        </p>
      )}

      {wb.pendingMappings.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-medium">Spaltenzuordnungen</p>
          {wb.pendingMappings.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p>
                <span className="font-mono text-xs">{m.filename}</span>
                {': '}
                {m.source_header}
                {' → '}
                {m.canonical_field ? timelineLabel(m.canonical_field) : 'unbekannt'}
              </p>
              <Button size="sm" onClick={() => wb.onApproveMapping(m.id)}>Bestätigen</Button>
            </div>
          ))}
        </div>
      )}

      <Queue
        analysisId={wb.analysisId}
        findings={wb.visibleFindings}
        totalCount={wb.totalCount}
        visibleCount={wb.visibleFindings.length}
        search={wb.search}
        severity={wb.severity}
        sortKey={wb.sortKey}
        sortDir={wb.sortDir}
        selectedId={selectedId}
        selectedFinding={selected}
        timeline={timeline.data}
        timelineLoading={timeline.isFetching}
        timelineError={timeline.isError}
        onTimelineRetry={() => void timeline.refetch()}
        heroFindings={wb.heroFindings}
        showHeroHints={wb.showHeroHints}
        onSearchChange={wb.onSearchChange}
        onSeverityChange={wb.onSeverityChange}
        onToggleSort={wb.onToggleSort}
        onSelect={(f) => selectFinding(f.id)}
        onHeroSelect={(hero) => {
          const match = wb.matchHeroFinding(hero)
          if (match) selectFinding(match.id)
        }}
      />
    </div>
  )
}
