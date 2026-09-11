import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { API_BASE } from '@/lib/api'
import type { ProposedAction } from '@/types'

export function useProposedActions(projectId: number | undefined) {
  const queryClient = useQueryClient()
  const list = useQuery({
    queryKey: ['actions', projectId],
    enabled: projectId != null,
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/projects/${projectId}/actions`)
      if (!response.ok) throw new Error(await response.text())
      return response.json() as Promise<{ actions: ProposedAction[] }>
    },
    refetchInterval: 8000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['actions'] })
  const confirm = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`${API_BASE}/api/actions/${id}/confirm`, { method: 'POST' })
      if (!response.ok) throw new Error(await response.text())
      return response.json()
    },
    onSuccess: () => {
      toast.success('Aktion freigegeben')
      void invalidate()
    },
    onError: () => toast.error('Freigabe fehlgeschlagen'),
  })
  const dismiss = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`${API_BASE}/api/actions/${id}/dismiss`, { method: 'POST' })
      if (!response.ok) throw new Error(await response.text())
      return response.json()
    },
    onSuccess: () => {
      toast.success('Entwurf verworfen')
      void invalidate()
    },
    onError: () => toast.error('Verwerfen fehlgeschlagen'),
  })

  return {
    actions: list.data?.actions ?? [],
    actionsLoading: list.isPending,
    actionsError: list.isError,
    pendingActionCount: (list.data?.actions ?? []).filter((action) => action.status === 'draft').length,
    actionMutationPending: confirm.isPending || dismiss.isPending,
    confirmAction: (id: number) => confirm.mutate(id),
    dismissAction: (id: number) => dismiss.mutate(id),
    retryActions: () => void list.refetch(),
  }
}
