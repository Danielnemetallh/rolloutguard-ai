export type Meta = {
  name: string
  demo_mode: boolean
  synthetic_data: boolean
  disclaimer: string
  user: { display_name: string; role: string }
  llm_enabled: boolean
  llm_model: string
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
    tool_trace: string[]
    abstained: boolean
    confidence: number
  }
}
