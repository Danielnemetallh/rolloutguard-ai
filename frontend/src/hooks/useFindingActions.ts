import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { apiFetch, describeApiError } from '@/lib/api'
import type { ExplainResult } from '../types'

export function useFindingActions(
  setStatusOverrides: Dispatch<SetStateAction<Record<number, string>>>,
) {
  const qc = useQueryClient()
  const lastExplainFindingId = useRef<number | null>(null)

  const review = useMutation({
    mutationFn: (args: { id: number; decision: string; reason: string }) =>
      apiFetch<{ finding_id: number; status: string }>(`/api/findings/${args.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: args.decision, reason: args.reason }),
      }),
    onSuccess: (data) => {
      setStatusOverrides((prev) => ({ ...prev, [data.finding_id]: data.status }))
      toast.success('Prüfung gespeichert')
      void qc.invalidateQueries({ queryKey: ['findings'] })
    },
    onError: (error) => toast.error(describeApiError(error)),
  })

  const explain = useMutation({
    mutationFn: (findingId: number) =>
      apiFetch<ExplainResult>(`/api/findings/${findingId}/explain`, {
        method: 'POST',
      }),
  })

  const explainFinding = (id: number) => {
    lastExplainFindingId.current = id
    explain.mutate(id)
  }

  return {
    explainPending: explain.isPending,
    reviewPending: review.isPending,
    reviewError: review.error ?? null,
    reviewSuccess: review.isSuccess,
    explainError: explain.error ?? null,
    explainResult: explain.data,
    explainFinding,
    retryExplain: () => {
      if (lastExplainFindingId.current != null) explain.mutate(lastExplainFindingId.current)
    },
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
    resetExplain: () => {
      lastExplainFindingId.current = null
      explain.reset()
    },
    resetReview: () => review.reset(),
  }
}
