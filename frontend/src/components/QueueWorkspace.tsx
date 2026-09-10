import { useSearchParams } from 'react-router-dom'
import { Queue } from '@/components/Queue'
import { SelectedFindingTimeline } from '@/components/SelectedFindingTimeline'
import { useWorkbench } from '@/context/workbench'

type QueueWorkspaceProps = {
  compact?: boolean
}

export function QueueWorkspace({ compact = false }: QueueWorkspaceProps) {
  const workbench = useWorkbench()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = Number(searchParams.get('befund')) || null
  const selectedFinding =
    workbench.findings.find((finding) => finding.id === selectedId) ?? null
  const visibleFindings = compact
    ? workbench.visibleFindings.slice(0, 12)
    : workbench.visibleFindings

  const selectFinding = (findingId: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('befund', String(findingId))
    setSearchParams(next, { replace: true })
    workbench.resetExplain()
  }

  return (
    <div>
      <Queue
        analysisId={workbench.analysisId}
        findings={visibleFindings}
        loading={workbench.findingsLoading}
        error={workbench.findingsError}
        selectedId={selectedId}
        totalCount={workbench.totalCount}
        visibleCount={workbench.visibleFindings.length}
        search={workbench.search}
        severity={workbench.severity}
        sortKey={workbench.sortKey}
        sortDir={workbench.sortDir}
        heroFindings={undefined}
        showHeroHints={false}
        onSearchChange={workbench.onSearchChange}
        onSeverityChange={workbench.onSeverityChange}
        onToggleSort={workbench.onToggleSort}
        onRetry={workbench.retryFindings}
        onSelect={(finding) => selectFinding(finding.id)}
        onHeroSelect={(hero) => {
          const match = workbench.matchHeroFinding(hero)
          if (match) selectFinding(match.id)
        }}
      />
      <SelectedFindingTimeline finding={selectedFinding} analysisId={workbench.analysisId} />
    </div>
  )
}
