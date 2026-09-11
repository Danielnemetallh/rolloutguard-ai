import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ANALYSIS_KEY, API_BASE, readStoredAnalysisId } from '@/lib/api'
import type { Diff, HeroFinding, Meta } from '../types'

type AnalysisSummary = {
  id: number
  batch_id: number
  status: string
  kpis: Record<string, number>
  created_at: string | null
}

export function useAnalysisSession() {
  const qc = useQueryClient()
  const [analysisId, setAnalysisId] = useState<number | null>(readStoredAnalysisId)
  const [heroFindings, setHeroFindings] = useState<HeroFinding[] | undefined>()

  useEffect(() => {
    if (analysisId != null) sessionStorage.setItem(ANALYSIS_KEY, String(analysisId))
    else sessionStorage.removeItem(ANALYSIS_KEY)
  }, [analysisId])

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
      setHeroFindings(data.hero_findings)
      toast.success(`Analyse abgeschlossen: Lauf #${data.analysis_run_id}`)
      void qc.invalidateQueries({ queryKey: ['findings'] })
      void qc.invalidateQueries({ queryKey: ['analyses'] })
    },
    onError: () => toast.error('Analyse fehlgeschlagen. Läuft die API?'),
  })

  const exportRun = useMutation({
    mutationFn: async (runId: number) => {
      const res = await fetch(`${API_BASE}/api/analyses/${runId}/exports`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ format?: string }>
    },
    onSuccess: () => toast.success('Export nach data/uploads/exports/ geschrieben'),
    onError: () => toast.error('Export fehlgeschlagen'),
  })

  const projectId = projects.data?.[0]?.id

  const analyses = useQuery({
    queryKey: ['analyses', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/analyses`)
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ count: number; analyses: AnalysisSummary[] }>
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

  const activeSummary = analyses.data?.analyses.find((a) => a.id === analysisId)
  const kpis = activeSummary?.kpis ?? analyze.data?.kpis

  return {
    meta,
    isLoading,
    error: error ?? null,
    analysisId,
    setAnalysisId,
    projectId,
    analyzePending: analyze.isPending,
    exportPending: exportRun.isPending,
    kpis,
    diff: diff.data,
    analyses: analyses.data?.analyses,
    analysesLoading: analyses.isPending,
    analysesError: analyses.isError,
    heroFindings,
    onAnalyze: (onSuccess?: () => void) => {
      if (!projectId) return
      analyze.mutate(projectId, { onSuccess: () => onSuccess?.() })
    },
    onExport: () => analysisId && exportRun.mutate(analysisId),
    retryAnalyses: () => void analyses.refetch(),
  }
}
