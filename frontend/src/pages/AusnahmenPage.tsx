import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Queue } from '@/components/Queue'
import { useWorkbench } from '@/context/WorkbenchContext'
import { useSelectedTimeline } from '@/hooks/useSelectedTimeline'

type AusnahmenPageProps = {
  theme: 'dark' | 'light'
  onThemeToggle: () => void
  agentOpen: boolean
  onAgentToggle: () => void
}

export function AusnahmenPage({
  theme,
  onThemeToggle,
  agentOpen,
  onAgentToggle,
}: AusnahmenPageProps) {
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
        title="Ausnahmen"
        description="Vollständige, sortierbare Ausnahme-Warteschlange."
        theme={theme}
        onThemeToggle={onThemeToggle}
        agentOpen={agentOpen}
        agentPending={wb.askPending}
        onAgentToggle={onAgentToggle}
      />
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
