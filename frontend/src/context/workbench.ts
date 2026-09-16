import { createContext, useContext } from 'react'
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
  findingsError: Error | null
  totalCount: number | undefined
  visibleFindings: Finding[]
  search: string
  severity: string
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  heroFindings: HeroFinding[] | undefined
  showHeroHints: boolean
  question: string
  lastQuestion: string
  askPending: boolean
  askError: Error | null
  askResult: AgentResult | undefined
  explainPending: boolean
  explainError: Error | null
  reviewPending: boolean
  reviewError: Error | null
  reviewSuccess: boolean
  explainResult: ExplainResult | undefined
  highlightedEvidenceId: string | null
  onAnalyze: () => void
  onExport: () => void
  retryBootstrap: () => void
  retryFindings: () => void
  onSelectRun: (id: number) => void
  onSearchChange: (value: string) => void
  onSeverityChange: (value: string) => void
  onToggleSort: (key: SortKey) => void
  matchHeroFinding: (hero: HeroFinding) => Finding | undefined
  questionChange: (value: string) => void
  submitQuestion: () => void
  retryQuestion: () => void
  highlightEvidence: (id: string) => void
  explainFinding: (id: number) => void
  retryExplain: () => void
  approveFinding: (id: number) => void
  dismissFinding: (id: number) => void
  resetExplain: () => void
}

export const WorkbenchContext = createContext<WorkbenchContextValue | null>(null)

export function useWorkbench() {
  const context = useContext(WorkbenchContext)
  if (!context) throw new Error('useWorkbench must be used within WorkbenchProvider')
  return context
}
