import { useMemo, useState, type ReactNode } from 'react'
import { useAgentAsk } from '@/hooks/useAgentAsk'
import { useAnalysisSession } from '@/hooks/useAnalysisSession'
import { useFindingActions } from '@/hooks/useFindingActions'
import { useFindingsQueue } from '@/hooks/useFindingsQueue'
import { useProposedActions } from '@/hooks/useProposedActions'
import { useWorkbenchExtras } from '@/hooks/useWorkbenchExtras'
import { WorkbenchContext, type WorkbenchContextValue } from '@/context/workbench'

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [statusOverrides, setStatusOverrides] = useState<Record<number, string>>({})
  const [highlightedEvidenceId, setHighlightedEvidenceId] = useState<string | null>(null)

  const session = useAnalysisSession()
  const queue = useFindingsQueue(session.analysisId, session.heroFindings, statusOverrides)
  const actions = useFindingActions(setStatusOverrides)
  const agent = useAgentAsk(session.analysisId)
  const extras = useWorkbenchExtras(session.projectId, session.analysisId)
  const proposedActions = useProposedActions(session.projectId)

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
      analysesLoading: session.analysesLoading,
      analysesError: session.analysesError,
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
      askPending: agent.askPending,
      askError: agent.askError,
      askResult: agent.askResult,
      history: agent.history,
      retryQuestion: agent.retryQuestion,
      startNewAgentSession: agent.startNewSession,
      loadAgentHistory: () => {
        void agent.loadSessionHistory()
      },
      resumeAgentSession: (sessionId) => {
        void agent.resumeSession(sessionId)
      },
      deleteAgentSession: (sessionId) => {
        void agent.deleteSession(sessionId)
      },
      renameAgentSession: (sessionId, title) => {
        void agent.renameSession(sessionId, title)
      },
      closeAgentHistory: agent.closeHistory,
      agentHistoryOpen: agent.historyOpen,
      savedAgentSessions: agent.savedSessions,
      explainPending: actions.explainPending,
      reviewPending: actions.reviewPending,
      reviewError: actions.reviewError,
      reviewSuccess: actions.reviewSuccess,
      explainResult: actions.explainResult,
      highlightedEvidenceId,
      integrations: extras.integrations,
      documents: extras.documents,
      documentsLoading: extras.documentsLoading,
      documentsError: extras.documentsError,
      pendingMappings: extras.pendingMappings,
      uploadPending: extras.uploadPending,
      actions: proposedActions.actions,
      actionsLoading: proposedActions.actionsLoading,
      actionsError: proposedActions.actionsError,
      pendingActionCount: proposedActions.pendingActionCount,
      actionMutationPending: proposedActions.actionMutationPending,
      onAnalyze: () => session.onAnalyze(() => setStatusOverrides({})),
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
      onUploadDocument: extras.onUploadDocument,
      onConnect: extras.onConnect,
      onDraftAction: extras.onDraftAction,
      onApproveMapping: extras.onApproveMapping,
      retryFindings: queue.retryFindings,
      retryDocuments: extras.retryDocuments,
      retryActions: proposedActions.retryActions,
      confirmAction: proposedActions.confirmAction,
      dismissAction: proposedActions.dismissAction,
      retryAnalyses: session.retryAnalyses,
    }),
    [session, queue, actions, agent, extras, proposedActions, highlightedEvidenceId],
  )

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>
}
