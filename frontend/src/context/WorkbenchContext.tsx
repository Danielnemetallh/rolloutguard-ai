import { useMemo, useState, type ReactNode } from 'react'
import { useAgentAsk } from '@/hooks/useAgentAsk'
import { useAnalysisSession } from '@/hooks/useAnalysisSession'
import { useFindingActions } from '@/hooks/useFindingActions'
import { useFindingsQueue } from '@/hooks/useFindingsQueue'
import { WorkbenchContext, type WorkbenchContextValue } from './workbench'

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [statusOverrides, setStatusOverrides] = useState<Record<number, string>>({})
  const [highlightedEvidenceId, setHighlightedEvidenceId] = useState<string | null>(null)

  const session = useAnalysisSession()
  const queue = useFindingsQueue(session.analysisId, session.heroFindings, statusOverrides)
  const actions = useFindingActions(setStatusOverrides)
  const agent = useAgentAsk(session.analysisId)

  const value = useMemo<WorkbenchContextValue>(
    () => ({
      meta: session.meta,
      isLoading: session.isLoading,
      error: session.error,
      analysisId: session.analysisId,
      projectId: session.projectId,
      analyzePending: session.analyzePending,
      exportPending: session.exportPending,
      kpis: session.kpis,
      diff: session.diff,
      analyses: session.analyses,
      findings: queue.findings,
      findingsLoading: queue.findingsLoading,
      findingsError: queue.findingsError,
      totalCount: queue.totalCount,
      visibleFindings: queue.visibleFindings,
      search: queue.search,
      severity: queue.severity,
      sortKey: queue.sortKey,
      sortDir: queue.sortDir,
      heroFindings: session.heroFindings,
      showHeroHints: queue.showHeroHints,
      question: agent.question,
      lastQuestion: agent.lastQuestion,
      askPending: agent.askPending,
      askError: agent.askError,
      askResult: agent.askResult,
      explainPending: actions.explainPending,
      explainError: actions.explainError,
      reviewPending: actions.reviewPending,
      reviewError: actions.reviewError,
      reviewSuccess: actions.reviewSuccess,
      explainResult: actions.explainResult,
      highlightedEvidenceId,
      onAnalyze: () => {
        actions.resetReview()
        session.onAnalyze(() => {
          setStatusOverrides({})
          setHighlightedEvidenceId(null)
        })
      },
      onExport: session.onExport,
      retryBootstrap: session.retryBootstrap,
      retryFindings: queue.retryFindings,
      onSelectRun: (id) => {
        session.setAnalysisId(id)
        setStatusOverrides({})
        setHighlightedEvidenceId(null)
        actions.resetExplain()
        actions.resetReview()
      },
      onSearchChange: queue.onSearchChange,
      onSeverityChange: queue.onSeverityChange,
      onToggleSort: queue.onToggleSort,
      matchHeroFinding: queue.matchHeroFinding,
      questionChange: agent.questionChange,
      submitQuestion: agent.submitQuestion,
      retryQuestion: agent.retryQuestion,
      highlightEvidence: (id) => {
        setHighlightedEvidenceId(id)
        document.getElementById(`evidence-${id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      },
      explainFinding: actions.explainFinding,
      retryExplain: actions.retryExplain,
      approveFinding: actions.approveFinding,
      dismissFinding: actions.dismissFinding,
      resetExplain: actions.resetExplain,
    }),
    [session, queue, actions, agent, highlightedEvidenceId],
  )

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>
}
