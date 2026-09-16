import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { API_BASE } from '@/lib/api'
import type { IntegrationStatus, ProposedAction, UploadedDocument } from '../types'

export function useWorkbenchExtras(projectId: number | undefined, analysisId: number | null) {
  const qc = useQueryClient()

  const integrations = useQuery({
    queryKey: ['integrations'],
    queryFn: async (): Promise<IntegrationStatus> => {
      const res = await fetch(`${API_BASE}/api/integrations/status`)
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  })

  const documents = useQuery({
    queryKey: ['documents', projectId],
    enabled: projectId != null,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/documents`)
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ documents: UploadedDocument[] }>
    },
  })

  const mappings = useQuery({
    queryKey: ['mappings', projectId],
    enabled: projectId != null,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/mappings`)
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{
        mappings: Array<{
          id: number
          source_header: string
          canonical_field: string | null
          filename: string
        }>
      }>
    },
  })

  const uploadDoc = useMutation({
    mutationFn: async (file: File) => {
      if (!projectId) throw new Error('no project')
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/documents`, {
        method: 'POST',
        body,
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
      toast.success('Dokument aufgenommen')
      void qc.invalidateQueries({ queryKey: ['documents'] })
    },
    onError: () => toast.error('Dokument konnte nicht gelesen werden'),
  })

  const connect = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/integrations/connect`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ url: string | null; message?: string }>
    },
    onSuccess: (data) => {
      if (data.url) window.open(data.url, '_blank', 'noopener')
      else toast.message(data.message ?? 'Connect nicht verfügbar. Hinweis in der Statuszeile.')
      void qc.invalidateQueries({ queryKey: ['integrations'] })
    },
  })

  const draftFromInspector = useMutation({
    mutationFn: async (args: {
      action_type: string
      payload: Record<string, unknown>
      site_id?: string
    }) => {
      if (!projectId || analysisId == null) throw new Error('no analysis')
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/actions/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_run_id: analysisId,
          action_type: args.action_type,
          payload: args.payload,
          site_id: args.site_id,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<ProposedAction>
    },
    onSuccess: () => {
      toast.success('Entwurf in der Aktionsqueue')
      void qc.invalidateQueries({ queryKey: ['actions'] })
    },
    onError: () => toast.error('Entwurf fehlgeschlagen'),
  })

  const approveMapping = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/api/column-mappings/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
      toast.success('Zuordnung bestätigt')
      void qc.invalidateQueries({ queryKey: ['mappings'] })
    },
  })

  return {
    integrations: integrations.data,
    documents: documents.data?.documents ?? [],
    documentsLoading: documents.isPending,
    documentsError: documents.isError,
    pendingMappings: mappings.data?.mappings ?? [],
    uploadPending: uploadDoc.isPending,
    onUploadDocument: (file: File) => uploadDoc.mutate(file),
    retryDocuments: () => void documents.refetch(),
    onConnect: () => connect.mutate(),
    onDraftAction: draftFromInspector.mutate,
    onApproveMapping: (id: number) => approveMapping.mutate(id),
  }
}
