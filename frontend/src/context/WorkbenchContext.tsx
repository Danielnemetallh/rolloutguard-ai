import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useAgentAsk } from '@/hooks/useAgentAsk'
import { useAnalysisSession } from '@/hooks/useAnalysisSession'
import { useFindingActions } from '@/hooks/useFindingActions'
import { useFindingsQueue } from '@/hooks/useFindingsQueue'
import { useProposedActions } from '@/hooks/useProposedActions'
import { useWorkbenchExtras } from '@/hooks/useWorkbenchExtras'
import type {
  AgentTurn,
  Diff,
  Finding,
  HeroFinding,
  IntegrationStatus,
  Meta,
  ProposedAction,
  SortKey,
  UploadedDocument,
} from '../types'

export type MappingRow = {
  id: number
  source_header: string
  canonical_field: string | null
  filename: string
}

export type DraftActionArgs = {
  action_type: string
  payload: Record<string, unknown>
  site_id?: string
}

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
  analyses:
    | Array<{
        id: number
        batch_id: number
        status: string
        kpis: Record<string, number>
        created_at: string | null
      }>
    | undefined
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
  history: AgentTurn[]
  activeSessionTitle: string
  sessions: ReturnType<typeof useAgentAsk>['sessions']
  explainPending: boolean
  reviewPending: boolean
  reviewError: boolean
  reviewSuccess: boolean
  highlightedEvidenceId: string | null
  integrations: IntegrationStatus | undefined
  documents: UploadedDocument[]
  pendingMappings: MappingRow[]
  uploadPending: boolean
  actions: ProposedAction[]
  draftCount: number
  confirmPending: boolean
  dismissPending: boolean
  onAnalyze: () => void
  onExport: () => void
  onSelectRun: (id: number) => void
  onSearchChange: (value: string) => void
  onSeverityChange: (value: string) => void
  onToggleSort: (key: SortKey) => void
  matchHeroFinding: (hero: HeroFinding) => Finding | undefined
  questionChange: (value: string) => void
  submitQuestion: (override?: string, contextLabel?: string) => void
  retryTurn: (turn: AgentTurn, contextLabel?: string) => void
  startNewChat: () => void
  selectSession: (id: string) => void
  highlightEvidence: (id: string) => void
  approveFinding: (id: number) => void
  dismissFinding: (id: number) => void
  onUploadDocument: (file: File) => void
  onConnect: () => void
  onApproveMapping: (id: number) => void
  onConfirmAction: (id: number) => void
  onDismissAction: (id: number) => void
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
  const extras = useWorkbenchExtras(session.projectId, session.analysisId)
  const proposed = useProposedActions(session.projectId)

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
      history: agent.history,
      activeSessionTitle: agent.activeSessionTitle,
      sessions: agent.sessions,
      explainPending: actions.explainPending,
      reviewPending: actions.reviewPending,
      reviewError: actions.reviewError,
      reviewSuccess: actions.reviewSuccess,
      highlightedEvidenceId,
      integrations: extras.integrations,
      documents: extras.documents,
      pendingMappings: extras.pendingMappings,
      uploadPending: extras.uploadPending,
      actions: proposed.actions,
      draftCount: proposed.pendingActionCount,
      confirmPending: proposed.actionMutationPending,
      dismissPending: proposed.actionMutationPending,
      onAnalyze: () => session.onAnalyze(() => setStatusOverrides({})),
      onExport: session.onExport,
      onSelectRun: (id) => {
        session.setAnalysisId(id)
      },
      onSearchChange: queue.onSearchChange,
      onSeverityChange: queue.onSeverityChange,
      onToggleSort: queue.onToggleSort,
      matchHeroFinding: queue.matchHeroFinding,
      questionChange: agent.questionChange,
      submitQuestion: agent.submitQuestion,
      retryTurn: agent.retryTurn,
      startNewChat: agent.startNewChat,
      selectSession: agent.selectSession,
      highlightEvidence: (id) => setHighlightedEvidenceId(id),
      approveFinding: actions.approveFinding,
      dismissFinding: actions.dismissFinding,
      onUploadDocument: extras.onUploadDocument,
      onConnect: extras.onConnect,
      onApproveMapping: extras.onApproveMapping,
      onConfirmAction: proposed.confirmAction,
      onDismissAction: proposed.dismissAction,
    }),
    [session, queue, actions, agent, extras, proposed, highlightedEvidenceId],
  )

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>
}
