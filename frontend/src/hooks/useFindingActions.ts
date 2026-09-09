import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'
import { toast } from 'sonner'
import { API_BASE } from '@/lib/api'
import type { ExplainResult } from '../types'

export function useFindingActions(
  setStatusOverrides: Dispatch<SetStateAction<Record<number, string>>>,
) {
  const qc = useQueryClient()

  const review = useMutation({
    mutationFn: async (args: { id: number; decision: string; reason: string }) => {
      const res = await fetch(`${API_BASE}/api/findings/${args.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: args.decision, reason: args.reason }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ finding_id: number; status: string }>
    },
    onSuccess: (data) => {
      setStatusOverrides((prev) => ({ ...prev, [data.finding_id]: data.status }))
      toast.success('Prüfung gespeichert')
      void qc.invalidateQueries({ queryKey: ['findings'] })
    },
    onError: () => toast.error('Prüfung konnte nicht gespeichert werden'),
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

  return {
    explainPending: explain.isPending,
    reviewPending: review.isPending,
    reviewError: review.isError,
    reviewSuccess: review.isSuccess,
    explainResult: explain.data,
    explainFinding: (id: number) => explain.mutate(id),
    approveFinding: (id: number) =>
      review.mutate({
        id,
        decision: 'approve',
        reason: 'Mit Partner-Manager bestätigt',
      }),
    dismissFinding: (id: number) =>
      review.mutate({
        id,
        decision: 'dismiss',
        reason: 'Falsch positiv / bereits erledigt',
      }),
    resetExplain: () => explain.reset(),
  }
}
