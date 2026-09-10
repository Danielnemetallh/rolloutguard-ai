export type Meta = {
  name: string
  demo_mode: boolean
  synthetic_data: boolean
  disclaimer: string
  user: { display_name: string; role: string }
  llm_enabled: boolean
  llm_model: string
  llm_provider?: string
}

export type Finding = {
  id: number
  site_id: string
  rule_id: string
  severity: string
  status: string
  message: string
  facts: Record<string, unknown>
  evidence: Array<{
    evidence_id: string
    file: string
    sheet: string
    row: number
    column: string
    value: string | null
  }>
}

export type HeroFinding = {
  site_id: string
  rule_id: string
  severity: string
  message: string
}

export type Timeline = {
  site_id: string
  partner_id: string | null
  timeline: Record<string, string | null>
  evidence: Finding['evidence']
  findings: Finding[]
}

export type AnalysisSummary = {
  id: number
  batch_id: number
  status: string
  kpis: Record<string, number>
  created_at: string | null
}

export type Diff = {
  analysis_run_id: number
  compared_to_run_id: number | null
  compared_to_created_at: string | null
  new_count: number
  resolved_count: number
  persisting_count: number
  new_findings: Finding[]
  resolved_findings: Finding[]
}

export type SortKey = 'severity' | 'site_id' | 'rule_id'

export type ExplainResult = {
  provider: string
  explanation: {
    summary: string
    evidence_ids: string[]
    blocker_category: string | null
    proposed_next_action: string | null
    confidence: number
    abstained: boolean
  }
}

export type AgentResult = {
  provider: string
  result: {
    answer: string
    site_ids: string[]
    evidence_ids: string[]
    memory_ids?: string[]
    citations?: AgentCitation[]
    proposed_action_ids?: number[]
    tool_trace: string[]
    abstained: boolean
    confidence: number
  }
}

export type AgentCitation = {
  id: string
  sourceKind: 'workbook_cell' | 'document_chunk'
  label: string
  locator: string
  snippet: string | null
  evidenceId: string | null
  documentId: number | null
}

export type AgentTurn = {
  id: string
  analysisRunId: number
  question: string
  status: 'pending' | 'complete' | 'error'
  result?: AgentResult
}

export type ProposedAction = {
  id: number
  action_type: string
  status: string
  payload: Record<string, unknown>
  site_ids: string[]
  evidence_ids: string[]
  result: Record<string, unknown>
  created_at: string | null
}

export type IntegrationStatus = {
  composio_configured: boolean
  composio_sdk_installed?: boolean
  connected?: boolean
  session_ready?: boolean
  oauth_needed?: boolean
  mode: string
  calendar: string
  connect_hint: string
}

export type UploadedDocument = {
  id: number
  filename: string
  kind: string
  site_ids: string[]
}

