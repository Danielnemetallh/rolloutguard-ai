import { useMutation, useQuery, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import './App.css'
import { AgentDock } from './components/AgentDock'
import { Inspector } from './components/Inspector'
import { Queue } from './components/Queue'
import { RunStrip } from './components/RunStrip'
import { TopBar } from './components/TopBar'
import type {
  AgentResult,
  Diff,
  ExplainResult,
  Finding,
  HeroFinding,
  Meta,
  SortKey,
} from './types'

const queryClient = new QueryClient()
const API_BASE = import.meta.env.VITE_API_BASE ?? ''
const DEFAULT_QUESTION =
  'Which three sites most threaten the September integration target, and why?'

function Shell() {
  const qc = useQueryClient()
  const [analysisId, setAnalysisId] = useState<number | null>(null)
  const [selected, setSelected] = useState<Finding | null>(null)
  const [severity, setSeverity] = useState<string>('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('severity')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [question, setQuestion] = useState(DEFAULT_QUESTION)
  const [heroFindings, setHeroFindings] = useState<HeroFinding[] | undefined>()

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
        hero_findings: HeroFinding[]
      }>
    },
    onSuccess: (data) => {
      setAnalysisId(data.analysis_run_id)
      setSelected(null)
      setHeroFindings(data.hero_findings)
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
    queryFn: async () => {
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
      return res.json() as Promise<ExplainResult>
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
      return res.json() as Promise<AgentResult>
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
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/analyses`)
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ count: number; analyses: Array<{
        id: number
        batch_id: number
        status: string
        kpis: Record<string, number>
        created_at: string | null
      }> }>
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

  const showHeroHints =
    analysisId != null && !search.trim() && !!heroFindings?.length

  const matchHeroFinding = (hero: HeroFinding) =>
    (findings.data?.findings ?? []).find(
      (f) =>
        f.rule_id === hero.rule_id &&
        f.site_id === hero.site_id &&
        f.message === hero.message,
    ) ??
    (findings.data?.findings ?? []).find(
      (f) => f.rule_id === hero.rule_id && f.site_id === hero.site_id,
    )

  return (
    <div className="app">
      <TopBar
        meta={meta}
        isLoading={isLoading}
        error={error}
        analysisId={analysisId}
        projectId={projectId}
        analyzePending={analyze.isPending}
        exportPending={exportRun.isPending}
        onAnalyze={() => projectId && analyze.mutate(projectId)}
        onExport={() => analysisId && exportRun.mutate(analysisId)}
      />
      <div className="demo-strip" role="status">
        Demo mode. Synthetic data only. Not affiliated with any operator.
      </div>
      {(analyze.isError || exportRun.isError || exportRun.isSuccess) && (
        <div className="demo-strip">
          {analyze.isError && (
            <span className="warn">Analysis failed. Is the API running?</span>
          )}
          {exportRun.isError && <span className="warn"> Export failed.</span>}
          {exportRun.isSuccess && (
            <span className="muted"> Export written to data/uploads/exports/.</span>
          )}
        </div>
      )}
      <main className="workbench">
        <RunStrip
          kpis={kpis}
          diff={diff.data}
          analyses={analyses.data?.analyses}
          analysisId={analysisId}
          onSelectRun={(id) => {
            setAnalysisId(id)
            setSelected(null)
            explain.reset()
          }}
        />
        <div className="workspace">
          <Queue
            analysisId={analysisId}
            findings={visibleFindings}
            totalCount={findings.data?.count}
            visibleCount={visibleFindings.length}
            search={search}
            severity={severity}
            sortKey={sortKey}
            sortDir={sortDir}
            selectedId={selected?.id ?? null}
            heroFindings={heroFindings}
            showHeroHints={showHeroHints}
            onSearchChange={setSearch}
            onSeverityChange={setSeverity}
            onToggleSort={toggleSort}
            onSelect={(f) => {
              setSelected(f)
              explain.reset()
            }}
            onHeroSelect={(hero) => {
              const match = matchHeroFinding(hero)
              if (match) {
                setSelected(match)
                explain.reset()
              }
            }}
          />
          <Inspector
            selected={selected}
            timeline={timeline.data}
            explainPending={explain.isPending}
            reviewPending={review.isPending}
            reviewClosed={reviewClosed}
            reviewError={review.isError}
            reviewSuccess={review.isSuccess}
            explainResult={explain.data}
            onExplain={() => selected && explain.mutate(selected.id)}
            onApprove={() =>
              selected &&
              review.mutate({
                id: selected.id,
                decision: 'approve',
                reason: 'Confirmed with partner manager',
              })
            }
            onDismiss={() =>
              selected &&
              review.mutate({
                id: selected.id,
                decision: 'dismiss',
                reason: 'False positive / already handled',
              })
            }
          />
        </div>
        <AgentDock
          analysisId={analysisId}
          question={question}
          pending={askAgent.isPending}
          error={askAgent.isError}
          result={askAgent.data}
          onQuestionChange={setQuestion}
          onSubmit={() => {
            if (analysisId && question.trim()) {
              askAgent.mutate({ analysisRunId: analysisId, question: question.trim() })
            }
          }}
        />
      </main>
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
