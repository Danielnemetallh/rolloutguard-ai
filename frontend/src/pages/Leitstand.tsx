import { useNavigate } from 'react-router-dom'
import { Queue } from '@/components/Queue'
import { RunStrip } from '@/components/RunStrip'
import { useWorkbench } from '@/context/workbench'

export function Leitstand() {
  const wb = useWorkbench()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <RunStrip
        kpis={wb.kpis}
        diff={wb.diff}
        analyses={wb.analyses}
        analysisId={wb.analysisId}
        onSelectRun={wb.onSelectRun}
      />
      <Queue
        analysisId={wb.analysisId}
        findings={wb.visibleFindings}
        error={wb.findingsError}
        totalCount={wb.totalCount}
        visibleCount={wb.visibleFindings.length}
        search={wb.search}
        severity={wb.severity}
        sortKey={wb.sortKey}
        sortDir={wb.sortDir}
        heroFindings={wb.heroFindings}
        showHeroHints={wb.showHeroHints}
        onSearchChange={wb.onSearchChange}
        onSeverityChange={wb.onSeverityChange}
        onToggleSort={wb.onToggleSort}
        onRetry={wb.retryFindings}
        onSelect={(f) => {
          wb.resetExplain()
          void navigate(`/befund/${f.id}`)
        }}
        onHeroSelect={(hero) => {
          const match = wb.matchHeroFinding(hero)
          if (match) {
            wb.resetExplain()
            void navigate(`/befund/${match.id}`)
          }
        }}
      />
    </div>
  )
}
