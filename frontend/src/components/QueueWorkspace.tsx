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
    <div className="queue-workspace">
      <div className="min-w-0">
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
      </div>
      <div className="queue-workspace-detail">
        {selectedFinding ? (
          <SelectedFindingTimeline finding={selectedFinding} analysisId={workbench.analysisId} />
        ) : (
          <div className="flex min-h-[440px] items-center justify-center px-8 text-center">
            <div className="max-w-[28ch]">
              <p className="text-sm font-medium">Befund auswählen</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Wählen Sie links eine Ausnahme, um Projektverlauf, Regelverletzung und Quellkoordinaten zu prüfen.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
