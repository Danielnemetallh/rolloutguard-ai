import { useCallback, useMemo, useState } from 'react'
import { API_BASE } from '@/lib/api'
import type { AgentResult, AgentTurn } from '../types'

export function useAgentAsk(analysisId: number | null) {
  const [draftsByRun, setDraftsByRun] = useState<Record<number, string>>({})
  const [turnsByRun, setTurnsByRun] = useState<Record<number, AgentTurn[]>>({})
  const turns = useMemo(
    () => (analysisId == null ? [] : (turnsByRun[analysisId] ?? [])),
    [analysisId, turnsByRun],
  )
  const draft = analysisId == null ? '' : (draftsByRun[analysisId] ?? '')

  const updateTurn = useCallback((analysisRunId: number, turnId: string, update: Partial<AgentTurn>) => {
    setTurnsByRun((current) => ({
      ...current,
      [analysisRunId]: (current[analysisRunId] ?? []).map((turn) =>
        turn.id === turnId ? { ...turn, ...update } : turn,
      ),
    }))
  }, [])

  const sendQuestion = useCallback(async (analysisRunId: number, question: string, turnId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/assistant/queries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_run_id: analysisRunId,
          question,
        }),
      })
      if (!response.ok) throw new Error(await response.text())
      const result = (await response.json()) as AgentResult
      updateTurn(analysisRunId, turnId, { status: 'complete', result })
    } catch {
      updateTurn(analysisRunId, turnId, { status: 'error', result: undefined })
    }
  }, [updateTurn])

  const submitQuestion = useCallback((override?: string) => {
    if (analysisId == null) return
    const question = (override ?? draft).trim()
    if (!question) return
    const duplicatePending = (turnsByRun[analysisId] ?? []).some(
      (turn) => turn.status === 'pending' && turn.question === question,
    )
    if (duplicatePending) return
    const turnId = globalThis.crypto?.randomUUID?.() ?? `${analysisId}-${Date.now()}`
    const pendingTurn: AgentTurn = {
      id: turnId,
      analysisRunId: analysisId,
      question,
      status: 'pending',
    }
    setTurnsByRun((current) => ({
      ...current,
      [analysisId]: [...(current[analysisId] ?? []), pendingTurn],
    }))
    setDraftsByRun((current) => ({ ...current, [analysisId]: '' }))
    void sendQuestion(analysisId, question, turnId)
  }, [analysisId, draft, sendQuestion, turnsByRun])

  const retryQuestion = useCallback((turnId: string) => {
    if (analysisId == null) return
    const turn = (turnsByRun[analysisId] ?? []).find((candidate) => candidate.id === turnId)
    if (!turn || turn.status === 'pending') return
    updateTurn(analysisId, turnId, { status: 'pending', result: undefined })
    void sendQuestion(analysisId, turn.question, turnId)
  }, [analysisId, sendQuestion, turnsByRun, updateTurn])

  return useMemo(() => ({
    question: draft,
    askPending: turns.some((turn) => turn.status === 'pending'),
    askError: turns.some((turn) => turn.status === 'error'),
    askResult: [...turns].reverse().find((turn) => turn.status === 'complete')?.result,
    history: turns,
    questionChange: (value: string) => {
      if (analysisId != null) setDraftsByRun((current) => ({ ...current, [analysisId]: value }))
    },
    submitQuestion,
    retryQuestion,
  }), [analysisId, draft, retryQuestion, submitQuestion, turns])
}
