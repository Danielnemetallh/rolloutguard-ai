import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ANALYSIS_KEY, API_BASE, apiErrorMessage, readStoredAnalysisId, workbookUploadName } from '@/lib/api'
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
      void qc.invalidateQueries({ queryKey: ['mappings'] })
    },
    onError: () => toast.error('Analyse fehlgeschlagen. Läuft die API?'),
  })

  const importWorkbooks = useMutation({
    mutationFn: async (args: { projectId: number; files: File[] }) => {
      const body = new FormData()
      for (const file of args.files) {
        body.append('files', file, workbookUploadName(file))
      }
      const res = await fetch(`${API_BASE}/api/projects/${args.projectId}/imports`, {
        method: 'POST',
        body,
      })
      if (!res.ok) throw new Error(apiErrorMessage(await res.text(), 'Workbook-Import fehlgeschlagen'))
      return res.json() as Promise<{
        analysis_run_id: number
        kpis: Record<string, number>
        site_count: number
        imported_files?: string[]
      }>
    },
    onSuccess: (data) => {
      setAnalysisId(data.analysis_run_id)
      setHeroFindings(undefined)
      const names = data.imported_files?.join(', ')
      toast.success(
        names
          ? `Datei aufgenommen: ${names} — Lauf #${data.analysis_run_id}`
          : `Import abgeschlossen: Lauf #${data.analysis_run_id}`,
      )
      void qc.invalidateQueries({ queryKey: ['findings'] })
      void qc.invalidateQueries({ queryKey: ['analyses'] })
      void qc.invalidateQueries({ queryKey: ['mappings'] })
      void qc.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Workbook-Import fehlgeschlagen'
      toast.error(message.length > 180 ? 'Workbook-Import fehlgeschlagen' : message)
    },
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
  const kpis = activeSummary?.kpis ?? analyze.data?.kpis ?? importWorkbooks.data?.kpis

  useEffect(() => {
    const runs = analyses.data?.analyses
    if (!runs?.length) return
    const stillThere = analysisId != null && runs.some((run) => run.id === analysisId)
    if (stillThere) return
    const synthetic = runs.find((run) => Number(run.kpis?.sites_total) === 50)
    setAnalysisId((synthetic ?? runs[0]).id)
  }, [analyses.data, analysisId])

  return {
    meta,
    isLoading,
    error: error ?? null,
    analysisId,
    setAnalysisId,
    projectId,
    analyzePending: analyze.isPending,
    importPending: importWorkbooks.isPending,
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
    onImportWorkbooks: (files: File[], onSuccess?: () => void) => {
      if (!projectId) {
        toast.error('Projekt noch nicht geladen — läuft die API?')
        return
      }
      if (files.length === 0) return
      importWorkbooks.mutate({ projectId, files }, { onSuccess: () => onSuccess?.() })
    },
    onExport: () => analysisId && exportRun.mutate(analysisId),
    retryAnalyses: () => void analyses.refetch(),
  }
}
