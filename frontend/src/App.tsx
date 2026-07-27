import { useMutation, useQuery, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import './App.css'

const queryClient = new QueryClient()
// Empty base = same-origin requests via Vite proxy (/api -> backend).
// Override with VITE_API_BASE=http://127.0.0.1:8000 only if you bypass the proxy.
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

type Meta = {
  name: string
  demo_mode: boolean
  synthetic_data: boolean
  disclaimer: string
  user: { display_name: string; role: string }
  llm_enabled: boolean
  llm_model: string
}

type Finding = {
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

type Timeline = {
  site_id: string
  partner_id: string | null
  timeline: Record<string, string | null>
  evidence: Finding['evidence']
  findings: Finding[]
}

type AnalysisSummary = {
  id: number
  batch_id: number
  status: string
  kpis: Record<string, number>
  created_at: string | null
}

type Diff = {
  analysis_run_id: number
  compared_to_run_id: number | null
  compared_to_created_at: string | null
  new_count: number
  resolved_count: number
  persisting_count: number
  new_findings: Finding[]
  resolved_findings: Finding[]
}

const DEFAULT_QUESTION = 'Which three sites most threaten the September integration target, and why?'
type SortKey = 'severity' | 'site_id' | 'rule_id'

function Shell() {
  const qc = useQueryClient()
  const [analysisId, setAnalysisId] = useState<number | null>(null)
  const [selected, setSelected] = useState<Finding | null>(null)
  const [severity, setSeverity] = useState<string>('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('severity')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [question, setQuestion] = useState(DEFAULT_QUESTION)

  const { data: meta, isLoading, error } = useQuery({
    queryKey: ['meta'],
    queryFn: async (): Promise<Meta> => {
      const res = await fetch(`${API_BASE}/api/meta`)
      if (!res.ok) throw new Error(`API ${res.status}`)
      return res.json()
    },
    retry: 1,
  })

  const projects = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/projects`)
      if (!res.ok) throw new Error(`API ${res.status}`)
      return res.json() as Promise<Array<{ id: number; name: string }>>
    },
    enabled: !error,
  })

  const analyze = useMutation({
    mutationFn: async (projectId: number) => {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/analyze-synthetic`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{
        analysis_run_id: number
        kpis: Record<string, number>
        hero_findings: Array<{ rule_id: string; severity: string; message: string }>
      }>
    },
    onSuccess: (data) => {
      setAnalysisId(data.analysis_run_id)
      setSelected(null)
      void qc.invalidateQueries({ queryKey: ['findings'] })
      void qc.invalidateQueries({ queryKey: ['analyses'] })
    },
  })

  const findings = useQuery({
    queryKey: ['findings', analysisId, severity],
    enabled: analysisId != null,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (severity) params.set('severity', severity)
      const res = await fetch(
        `${API_BASE}/api/analyses/${analysisId}/findings?${params.toString()}`,
      )
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ count: number; findings: Finding[] }>
    },
  })

  const timeline = useQuery({
    queryKey: ['timeline', selected?.site_id, analysisId],
    enabled: !!selected?.site_id && analysisId != null,
    queryFn: async (): Promise<Timeline> => {
      const res = await fetch(
        `${API_BASE}/api/sites/${selected!.site_id}/timeline?analysis_id=${analysisId}`,
      )
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  })

  const review = useMutation({
    mutationFn: async (args: { id: number; decision: string; reason: string }) => {
      const res = await fetch(`${API_BASE}/api/findings/${args.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: args.decision, reason: args.reason }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{
        finding_id: number
        status: string
        decision: string
        reason: string | null
      }>
    },
    onSuccess: (data, variables) => {
      setSelected((prev) =>
        prev?.id === variables.id ? { ...prev, status: data.status } : prev,
      )
      void qc.invalidateQueries({ queryKey: ['findings'] })
    },
  })

  const explain = useMutation({
    mutationFn: async (findingId: number) => {
      const res = await fetch(`${API_BASE}/api/findings/${findingId}/explain`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{
        provider: string
        explanation: {
          summary: string
          evidence_ids: string[]
          blocker_category: string | null
          proposed_next_action: string | null
          confidence: number
          abstained: boolean
        }
      }>
    },
  })

  const askAgent = useMutation({
    mutationFn: async (args: { analysisRunId: number; question: string }) => {
      const res = await fetch(`${API_BASE}/api/assistant/queries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_run_id: args.analysisRunId,
          question: args.question,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{
        provider: string
        result: {
          answer: string
          site_ids: string[]
          evidence_ids: string[]
          tool_trace: string[]
          abstained: boolean
          confidence: number
        }
      }>
    },
  })

  const exportRun = useMutation({
    mutationFn: async (runId: number) => {
      const res = await fetch(`${API_BASE}/api/analyses/${runId}/exports`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ format?: string; xlsx?: string; markdown?: string }>
    },
  })

  const projectId = projects.data?.[0]?.id

  const analyses = useQuery({
    queryKey: ['analyses', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<{ count: number; analyses: AnalysisSummary[] }> => {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/analyses`)
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  })

  const diff = useQuery({
    queryKey: ['diff', analysisId],
    enabled: analysisId != null,
    queryFn: async (): Promise<Diff> => {
      const res = await fetch(`${API_BASE}/api/analyses/${analysisId}/diff`)
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  })

  const visibleFindings = (findings.data?.findings ?? [])
    .filter((f) => {
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      return (
        f.site_id.toLowerCase().includes(q) ||
        f.rule_id.toLowerCase().includes(q) ||
        f.message.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      return a[sortKey] < b[sortKey] ? -1 * dir : a[sortKey] > b[sortKey] ? 1 * dir : 0
    })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const activeSummary = analyses.data?.analyses.find((a) => a.id === analysisId)
  const kpis = activeSummary?.kpis ?? analyze.data?.kpis
  const reviewClosed =
    selected?.status === 'approved' || selected?.status === 'dismissed'

  return (
    <div className="app">
      <div className="banner" role="status">
        Demo mode — synthetic data only. Not affiliated with any operator.
      </div>
      <header className="header">
        <div>
          <p className="eyebrow">RolloutGuard AI</p>
          <h1>Evidence-linked rollout controls</h1>
          <p className="lede">
            Reconcile contract, schedule, and site-status workbooks into a
            traceable exception queue.
          </p>
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={!projectId || analyze.isPending}
              onClick={() => projectId && analyze.mutate(projectId)}
            >
              {analyze.isPending ? 'Analyzing…' : 'Run synthetic analysis'}
            </button>
            <button
              type="button"
              disabled={!analysisId || exportRun.isPending}
              onClick={() => analysisId && exportRun.mutate(analysisId)}
            >
              {exportRun.isPending ? 'Exporting…' : 'Export (.xlsx + .md)'}
            </button>
            {analyze.isError && <span className="warn">Analysis failed — is the API running?</span>}
            {exportRun.isError && <span className="warn">Export failed.</span>}
            {exportRun.isSuccess && <span className="muted">Export written to data/uploads/exports/.</span>}
          </div>
        </div>
        <div className="meta-card">
          {isLoading && <p>Connecting to API…</p>}
          {error && (
            <p className="warn">
              API offline. Start with <code>scripts/dev-api.ps1</code>.
            </p>
          )}
          {meta && (
            <>
              <p>
                <strong>{meta.user.display_name}</strong> · {meta.user.role}
              </p>
              <p>LLM: {meta.llm_enabled ? meta.llm_model : 'deterministic mock'}</p>
              {analysisId && <p>Analysis run #{analysisId}</p>}
            </>
          )}
        </div>
      </header>

      {kpis && (
        <section className="kpi-row">
          <div><span>Sites</span><strong>{kpis.sites_total}</strong></div>
          <div><span>Findings</span><strong>{kpis.findings_total}</strong></div>
          <div><span>Critical</span><strong>{kpis.findings_critical}</strong></div>
          <div><span>SLA risk</span><strong>{kpis.sites_with_sla_risk}</strong></div>
        </section>
      )}

      {diff.data && diff.data.compared_to_run_id != null && (
        <section className="diff-row muted">
          Since run #{diff.data.compared_to_run_id}:{' '}
          <strong className="warn">{diff.data.new_count} new</strong> ·{' '}
          <strong>{diff.data.resolved_count} resolved</strong> ·{' '}
          {diff.data.persisting_count} unchanged
        </section>
      )}

      {analyses.data && analyses.data.analyses.length > 1 && (
        <section className="history-panel">
          <h2>Run history</h2>
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>When</th>
                <th>Findings</th>
                <th>Critical</th>
              </tr>
            </thead>
            <tbody>
              {analyses.data.analyses.map((a) => (
                <tr
                  key={a.id}
                  className={analysisId === a.id ? 'selected' : ''}
                  onClick={() => setAnalysisId(a.id)}
                >
                  <td>#{a.id}</td>
                  <td>{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                  <td>{a.kpis?.findings_total ?? '—'}</td>
                  <td>{a.kpis?.findings_critical ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="workspace">
        <section className="findings-panel">
          <div className="panel-head">
            <h2>Findings {findings.data && `(${visibleFindings.length}/${findings.data.count})`}</h2>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
            </select>
          </div>
          {analysisId && (
            <input
              type="search"
              className="search-box"
              placeholder="Search site, rule, or message…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          {!analysisId && <p className="muted">Run analysis to populate the exception queue.</p>}
          {findings.data && (
            <table>
              <thead>
                <tr>
                  <th onClick={() => toggleSort('severity')}>
                    Severity {sortKey === 'severity' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => toggleSort('site_id')}>
                    Site {sortKey === 'site_id' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => toggleSort('rule_id')}>
                    Rule {sortKey === 'rule_id' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {visibleFindings.map((f) => (
                  <tr
                    key={f.id}
                    className={selected?.id === f.id ? 'selected' : ''}
                    onClick={() => setSelected(f)}
                  >
                    <td><span className={`sev ${f.severity}`}>{f.severity}</span></td>
                    <td>{f.site_id}</td>
                    <td>{f.rule_id}</td>
                    <td>{f.message}</td>
                  </tr>
                ))}
                {visibleFindings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">No findings match "{search}".</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>

        <aside className="evidence-panel">
          <h2>Evidence</h2>
          {!selected && <p className="muted">Select a finding to inspect lineage.</p>}
          {selected && (
            <>
              <p className="eyebrow">{selected.rule_id} · {selected.site_id}</p>
              <p>
                <span className={`review-status ${selected.status}`}>{selected.status}</span>
              </p>
              <p>{selected.message}</p>
              <h3>Source cells</h3>
              <ul>
                {selected.evidence.map((e) => (
                  <li key={e.evidence_id}>
                    <code>{e.evidence_id}</code> {e.file} / {e.sheet} r{e.row} · {e.column}
                    {e.value != null && <> = <em>{e.value}</em></>}
                  </li>
                ))}
              </ul>
              {timeline.data && (
                <>
                  <h3>Site timeline</h3>
                  <dl className="timeline">
                    {Object.entries(timeline.data.timeline).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v ?? '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
              <div className="actions">
                <button
                  type="button"
                  onClick={() => explain.mutate(selected.id)}
                  disabled={explain.isPending}
                >
                  {explain.isPending ? 'Explaining…' : 'AI explain'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    review.mutate({
                      id: selected.id,
                      decision: 'approve',
                      reason: 'Confirmed with partner manager',
                    })
                  }
                  disabled={review.isPending || reviewClosed}
                >
                  {review.isPending ? 'Saving…' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    review.mutate({
                      id: selected.id,
                      decision: 'dismiss',
                      reason: 'False positive / already handled',
                    })
                  }
                  disabled={review.isPending || reviewClosed}
                >
                  Dismiss
                </button>
              </div>
              {review.isError && (
                <p className="warn">Could not save review — is the API running?</p>
              )}
              {review.isSuccess && reviewClosed && (
                <p className="muted">Review saved ({selected.status}).</p>
              )}
              {explain.data && (
                <div className="ai-box">
                  <h3>AI explanation</h3>
                  <p>{explain.data.explanation.summary}</p>
                  {explain.data.explanation.proposed_next_action && (
                    <p>
                      <strong>Next:</strong> {explain.data.explanation.proposed_next_action}
                    </p>
                  )}
                  <p className="muted">
                    category={explain.data.explanation.blocker_category ?? '—'} ·
                    confidence={explain.data.explanation.confidence} ·
                    abstained={String(explain.data.explanation.abstained)}
                  </p>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      <section className="agent-panel">
        <h2>Ask the agent</h2>
        <p className="muted">
          Read-only — the agent can query KPIs, findings, and site timelines, but never changes them.
        </p>
        <form
          className="agent-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (analysisId && question.trim()) {
              askAgent.mutate({ analysisRunId: analysisId, question: question.trim() })
            }
          }}
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about this analysis run…"
            disabled={!analysisId}
          />
          <button type="submit" disabled={!analysisId || askAgent.isPending || !question.trim()}>
            {askAgent.isPending ? 'Asking…' : 'Ask'}
          </button>
        </form>
        {askAgent.isError && <p className="warn">Agent query failed.</p>}
        {askAgent.data && <pre>{askAgent.data.result.answer}</pre>}
      </section>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  )
}
