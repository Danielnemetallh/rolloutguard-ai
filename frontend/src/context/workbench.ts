import { createContext, useContext } from 'react'
import type { AgentViewportContext } from '@/hooks/useAgentViewportContext'
import type {
  AgentResult,
  AgentSessionSummary,
  AgentTurn,
  Diff,
  ExplainResult,
  Finding,
  HeroFinding,
  IntegrationStatus,
  Meta,
  ProposedAction,
  SortKey,
  UploadedDocument,
} from '@/types'

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
  analysesLoading: boolean
  analysesError: boolean
  findings: Finding[]
  findingsLoading: boolean
  findingsError: boolean
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
  history: AgentTurn[]
  retryQuestion: (turnId: string, viewport?: AgentViewportContext) => void
  startNewAgentSession: () => void
  loadAgentHistory: () => void
  resumeAgentSession: (sessionId: string) => void
  deleteAgentSession: (sessionId: string) => void
  renameAgentSession: (sessionId: string, title: string) => void
  closeAgentHistory: () => void
  agentHistoryOpen: boolean
  savedAgentSessions: AgentSessionSummary[]
  explainPending: boolean
  reviewPending: boolean
  reviewError: boolean
  reviewSuccess: boolean
  explainResult: ExplainResult | undefined
  highlightedEvidenceId: string | null
  integrations: IntegrationStatus | undefined
  documents: UploadedDocument[]
  documentsLoading: boolean
  documentsError: boolean
  pendingMappings: MappingRow[]
  uploadPending: boolean
  actions: ProposedAction[]
  actionsLoading: boolean
  actionsError: boolean
  pendingActionCount: number
  actionMutationPending: boolean
  onAnalyze: () => void
  onExport: () => void
  onSelectRun: (id: number) => void
  onSearchChange: (value: string) => void
  onSeverityChange: (value: string) => void
  onToggleSort: (key: SortKey) => void
  matchHeroFinding: (hero: HeroFinding) => Finding | undefined
  questionChange: (value: string) => void
  submitQuestion: (override?: string, viewport?: AgentViewportContext) => void
  highlightEvidence: (id: string) => void
  explainFinding: (id: number) => void
  approveFinding: (id: number) => void
  dismissFinding: (id: number) => void
  resetExplain: () => void
  onUploadDocument: (file: File) => void
  onConnect: () => void
  onDraftAction: (args: DraftActionArgs) => void
  onApproveMapping: (id: number) => void
  retryFindings: () => void
  retryDocuments: () => void
  retryActions: () => void
  confirmAction: (id: number) => void
  dismissAction: (id: number) => void
  retryAnalyses: () => void
}

export const WorkbenchContext = createContext<WorkbenchContextValue | null>(null)

export function useWorkbench() {
  const context = useContext(WorkbenchContext)
  if (!context) throw new Error('useWorkbench must be used within WorkbenchProvider')
  return context
}
