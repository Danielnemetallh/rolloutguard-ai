import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ANALYSIS_KEY, apiFetch, describeApiError, readStoredAnalysisId } from '@/lib/api'
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

  const {
    data: meta,
    isLoading: metaLoading,
    error: metaError,
    refetch: refetchMeta,
  } = useQuery({
    queryKey: ['meta'],
    queryFn: () => apiFetch<Meta>('/api/meta'),
    retry: 1,
  })

  const projects = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Array<{ id: number; name: string }>>('/api/projects'),
    enabled: !metaError,
  })

  const analyze = useMutation({
    mutationFn: (projectId: number) =>
      apiFetch<{
        analysis_run_id: number
        kpis: Record<string, number>
        hero_findings: HeroFinding[]
      }>(`/api/projects/${projectId}/analyze-synthetic`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      setAnalysisId(data.analysis_run_id)
      setHeroFindings(data.hero_findings)
      toast.success(`Analyse abgeschlossen — Lauf #${data.analysis_run_id}`)
      void qc.invalidateQueries({ queryKey: ['findings'] })
      void qc.invalidateQueries({ queryKey: ['analyses'] })
    },
    onError: (error) => toast.error(describeApiError(error)),
  })

  const exportRun = useMutation({
    mutationFn: (runId: number) =>
      apiFetch<{ format?: string }>(`/api/analyses/${runId}/exports`, { method: 'POST' }),
    onSuccess: () => toast.success('Export nach data/uploads/exports/ geschrieben'),
    onError: (error) => toast.error(describeApiError(error)),
  })

  const projectId = projects.data?.[0]?.id

  const analyses = useQuery({
    queryKey: ['analyses', projectId],
    enabled: !!projectId,
    queryFn: () =>
      apiFetch<{ count: number; analyses: AnalysisSummary[] }>(
        `/api/projects/${projectId!}/analyses`,
      ),
  })

  const diff = useQuery({
    queryKey: ['diff', analysisId],
    enabled: analysisId != null,
    queryFn: () => apiFetch<Diff>(`/api/analyses/${analysisId!}/diff`),
  })

  const selectAnalysis = (id: number | null) => {
    setAnalysisId(id)
    setHeroFindings(undefined)
  }

  useEffect(() => {
    if (!analyses.data || analyze.isPending || analyses.isFetching) return
    if (analysisId != null && analyses.data.analyses.some((run) => run.id === analysisId)) return
    setAnalysisId(analyses.data.analyses[0]?.id ?? null)
    setHeroFindings(undefined)
  }, [analyses.data, analyses.isFetching, analyze.isPending, analysisId])

  const activeSummary = analyses.data?.analyses.find((a) => a.id === analysisId)
  const kpis = activeSummary?.kpis ?? analyze.data?.kpis

  return {
    meta,
    isLoading: metaLoading || projects.isLoading,
    error: metaError ?? projects.error ?? null,
    analysisId,
    setAnalysisId: selectAnalysis,
    projectId,
    analyzePending: analyze.isPending,
    exportPending: exportRun.isPending,
    kpis,
    diff: diff.data,
    analyses: analyses.data?.analyses,
    heroFindings,
    retryBootstrap: () => {
      void refetchMeta()
      void projects.refetch()
    },
    onAnalyze: (onSuccess?: () => void) => {
      if (!projectId) return
      analyze.mutate(projectId, { onSuccess: () => onSuccess?.() })
    },
    onExport: () => analysisId && exportRun.mutate(analysisId),
  }
}
