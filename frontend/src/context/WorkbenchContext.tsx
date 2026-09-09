import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useAgentAsk } from '@/hooks/useAgentAsk'
import { useAnalysisSession } from '@/hooks/useAnalysisSession'
import { useFindingActions } from '@/hooks/useFindingActions'
import { useFindingsQueue } from '@/hooks/useFindingsQueue'
import type {
  AgentResult,
  Diff,
  ExplainResult,
  Finding,
  HeroFinding,
  Meta,
  SortKey,
} from '../types'

export type WorkbenchContextValue = {
  meta: Meta | undefined
  isLoading: boolean
  error: Error | null
  analysisId: number | null
  projectId: number | undefined
  analyzePending: boolean
  exportPending: boolean
  kpis: Record<string, number> | undefined
  diff: Diff | undefined
  analyses: Array<{
    id: number
    batch_id: number
    status: string
    kpis: Record<string, number>
    created_at: string | null
  }> | undefined
  findings: Finding[]
  findingsLoading: boolean
  totalCount: number | undefined
  visibleFindings: Finding[]
  search: string
  severity: string
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  heroFindings: HeroFinding[] | undefined
  showHeroHints: boolean
  question: string
  askPending: boolean
  askError: boolean
  askResult: AgentResult | undefined
  explainPending: boolean
  reviewPending: boolean
  reviewError: boolean
  reviewSuccess: boolean
  explainResult: ExplainResult | undefined
  highlightedEvidenceId: string | null
  onAnalyze: () => void
  onExport: () => void
  onSelectRun: (id: number) => void
  onSearchChange: (value: string) => void
  onSeverityChange: (value: string) => void
  onToggleSort: (key: SortKey) => void
  matchHeroFinding: (hero: HeroFinding) => Finding | undefined
  questionChange: (value: string) => void
  submitQuestion: () => void
  highlightEvidence: (id: string) => void
  explainFinding: (id: number) => void
  approveFinding: (id: number) => void
  dismissFinding: (id: number) => void
  resetExplain: () => void
}

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null)

export function useWorkbench() {
  const ctx = useContext(WorkbenchContext)
  if (!ctx) throw new Error('useWorkbench must be used within WorkbenchProvider')
  return ctx
}

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
      totalCount: queue.totalCount,
      visibleFindings: queue.visibleFindings,
      search: queue.search,
      severity: queue.severity,
      sortKey: queue.sortKey,
      sortDir: queue.sortDir,
      heroFindings: session.heroFindings,
      showHeroHints: queue.showHeroHints,
      question: agent.question,
      askPending: agent.askPending,
      askError: agent.askError,
      askResult: agent.askResult,
      explainPending: actions.explainPending,
      reviewPending: actions.reviewPending,
      reviewError: actions.reviewError,
      reviewSuccess: actions.reviewSuccess,
      explainResult: actions.explainResult,
      highlightedEvidenceId,
      onAnalyze: () =>
        session.onAnalyze(() => setStatusOverrides({})),
      onExport: session.onExport,
      onSelectRun: (id) => {
        session.setAnalysisId(id)
        actions.resetExplain()
      },
      onSearchChange: queue.onSearchChange,
      onSeverityChange: queue.onSeverityChange,
      onToggleSort: queue.onToggleSort,
      matchHeroFinding: queue.matchHeroFinding,
      questionChange: agent.questionChange,
      submitQuestion: agent.submitQuestion,
      highlightEvidence: (id) => {
        setHighlightedEvidenceId(id)
        document.getElementById(`evidence-${id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      },
      explainFinding: actions.explainFinding,
      approveFinding: actions.approveFinding,
      dismissFinding: actions.dismissFinding,
      resetExplain: actions.resetExplain,
    }),
    [session, queue, actions, agent, highlightedEvidenceId],
  )

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>
}
