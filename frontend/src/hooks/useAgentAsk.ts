import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { AgentViewportContext } from '@/hooks/useAgentViewportContext'
import { API_BASE } from '@/lib/api'
import type {
  AgentCitation,
  AgentResult,
  AgentSessionDetail,
  AgentSessionSummary,
  AgentTurn,
} from '../types'

function turnsFromSession(session: AgentSessionDetail): AgentTurn[] {
  const turns: AgentTurn[] = []
  let pendingQuestion: AgentSessionDetail['messages'][number] | null = null

  for (const message of session.messages) {
    if (message.role === 'user') {
      pendingQuestion = message
      continue
    }
    if (message.role !== 'assistant' || pendingQuestion == null) continue
    const stored = message.citations ?? {}
    const citations = Array.isArray(stored.citations) ? stored.citations as AgentCitation[] : []
    turns.push({
      id: String(pendingQuestion.id),
      analysisRunId: session.analysis_run_id,
      question: pendingQuestion.content,
      status: 'complete',
      result: {
        provider: 'session',
        session_id: session.session_id,
        result: {
          answer: message.content,
          site_ids: [],
          evidence_ids: Array.isArray(stored.evidence_ids) ? stored.evidence_ids as string[] : [],
          memory_ids: Array.isArray(stored.memory_ids) ? stored.memory_ids as string[] : [],
          citations,
          proposed_action_ids: Array.isArray(stored.proposed_action_ids)
            ? stored.proposed_action_ids as number[]
            : [],
          tool_trace: message.tool_trace ?? [],
          abstained: false,
          confidence: 1,
        },
      },
    })
    pendingQuestion = null
  }
  return turns
}

export function useAgentAsk(analysisId: number | null) {
  const [draftsByRun, setDraftsByRun] = useState<Record<number, string>>({})
  const [turnsByRun, setTurnsByRun] = useState<Record<number, AgentTurn[]>>({})
  const [sessionIdByRun, setSessionIdByRun] = useState<Record<number, string>>({})
  const [savedSessions, setSavedSessions] = useState<AgentSessionSummary[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const turns = useMemo(
    () => (analysisId == null ? [] : (turnsByRun[analysisId] ?? [])),
    [analysisId, turnsByRun],
  )
  const draft = analysisId == null ? '' : (draftsByRun[analysisId] ?? '')
  const sessionId = analysisId == null ? undefined : sessionIdByRun[analysisId]

  const updateTurn = useCallback((analysisRunId: number, turnId: string, update: Partial<AgentTurn>) => {
    setTurnsByRun((current) => ({
      ...current,
      [analysisRunId]: (current[analysisRunId] ?? []).map((turn) =>
        turn.id === turnId ? { ...turn, ...update } : turn,
      ),
    }))
  }, [])

  const sendQuestion = useCallback(async (
    analysisRunId: number,
    question: string,
    turnId: string,
    activeSessionId?: string,
    viewport?: AgentViewportContext,
  ) => {
    try {
      const response = await fetch(`${API_BASE}/api/assistant/queries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_run_id: analysisRunId,
          question,
          ...(activeSessionId ? { session_id: activeSessionId } : {}),
          ...(viewport
            ? {
                viewport: {
                  page: viewport.page,
                  label: viewport.label,
                  finding_id: viewport.findingId,
                  selected_finding: viewport.selectedFinding,
                  pending_draft_count: viewport.pendingDraftCount,
                },
              }
            : {}),
        }),
      })
      if (!response.ok) throw new Error(await response.text())
      const result = (await response.json()) as AgentResult
      if (result.session_id) {
        setSessionIdByRun((current) => ({ ...current, [analysisRunId]: result.session_id as string }))
      }
      updateTurn(analysisRunId, turnId, { status: 'complete', result })
    } catch {
      updateTurn(analysisRunId, turnId, { status: 'error', result: undefined })
    }
  }, [updateTurn])

  const submitQuestion = useCallback((override?: string, viewport?: AgentViewportContext) => {
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
    void sendQuestion(analysisId, question, turnId, sessionIdByRun[analysisId], viewport)
  }, [analysisId, draft, sendQuestion, sessionIdByRun, turnsByRun])

  const retryQuestion = useCallback((turnId: string, viewport?: AgentViewportContext) => {
    if (analysisId == null) return
    const turn = (turnsByRun[analysisId] ?? []).find((candidate) => candidate.id === turnId)
    if (!turn || turn.status === 'pending') return
    updateTurn(analysisId, turnId, { status: 'pending', result: undefined })
    void sendQuestion(analysisId, turn.question, turnId, sessionIdByRun[analysisId], viewport)
  }, [analysisId, sendQuestion, sessionIdByRun, turnsByRun, updateTurn])

  const startNewSession = useCallback(() => {
    if (analysisId == null) return
    setHistoryOpen(false)
    void (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/assistant/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysis_run_id: analysisId }),
        })
        if (!response.ok) throw new Error(await response.text())
        const created = (await response.json()) as { session_id: string }
        setSessionIdByRun((current) => ({ ...current, [analysisId]: created.session_id }))
        setTurnsByRun((current) => ({ ...current, [analysisId]: [] }))
        setDraftsByRun((current) => ({ ...current, [analysisId]: '' }))
      } catch {
        toast.error('Neue Sitzung konnte nicht angelegt werden.')
      }
    })()
  }, [analysisId])

  const loadSessionHistory = useCallback(async () => {
    if (analysisId == null) return
    const response = await fetch(
      `${API_BASE}/api/assistant/sessions?analysis_run_id=${analysisId}`,
    )
    if (!response.ok) throw new Error(await response.text())
    const payload = (await response.json()) as { sessions: AgentSessionSummary[] }
    setSavedSessions(payload.sessions)
    setHistoryOpen(true)
  }, [analysisId])

  const resumeSession = useCallback(async (resumeSessionId: string) => {
    if (analysisId == null) return
    const response = await fetch(`${API_BASE}/api/assistant/sessions/${resumeSessionId}`)
    if (!response.ok) throw new Error(await response.text())
    const session = (await response.json()) as AgentSessionDetail
    setSessionIdByRun((current) => ({ ...current, [analysisId]: session.session_id }))
    setTurnsByRun((current) => ({ ...current, [analysisId]: turnsFromSession(session) }))
    setHistoryOpen(false)
  }, [analysisId])

  const deleteSession = useCallback(async (targetSessionId: string) => {
    if (analysisId == null) return
    const response = await fetch(`${API_BASE}/api/assistant/sessions/${targetSessionId}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error(await response.text())
    setSavedSessions((current) =>
      current.filter((session) => session.session_id !== targetSessionId),
    )
    if (sessionIdByRun[analysisId] === targetSessionId) {
      setTurnsByRun((current) => ({ ...current, [analysisId]: [] }))
      setDraftsByRun((current) => ({ ...current, [analysisId]: '' }))
      setSessionIdByRun((current) => {
        const next = { ...current }
        delete next[analysisId]
        return next
      })
    }
  }, [analysisId, sessionIdByRun])

  const renameSession = useCallback(async (targetSessionId: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    const response = await fetch(`${API_BASE}/api/assistant/sessions/${targetSessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
    if (!response.ok) throw new Error(await response.text())
    const session = (await response.json()) as AgentSessionSummary
    setSavedSessions((current) =>
      current.map((item) =>
        item.session_id === targetSessionId
          ? { ...item, preview: session.preview }
          : item,
      ),
    )
  }, [])

  return useMemo(() => ({
    question: draft,
    askPending: turns.some((turn) => turn.status === 'pending'),
    askError: turns.some((turn) => turn.status === 'error'),
    askResult: [...turns].reverse().find((turn) => turn.status === 'complete')?.result,
    history: turns,
    sessionId,
    savedSessions,
    historyOpen,
    questionChange: (value: string) => {
      if (analysisId != null) setDraftsByRun((current) => ({ ...current, [analysisId]: value }))
    },
    submitQuestion,
    retryQuestion,
    startNewSession,
    loadSessionHistory,
    resumeSession,
    deleteSession,
    renameSession,
    closeHistory: () => setHistoryOpen(false),
  }), [
    analysisId,
    draft,
    historyOpen,
    deleteSession,
    loadSessionHistory,
    renameSession,
    resumeSession,
    retryQuestion,
    savedSessions,
    sessionId,
    startNewSession,
    submitQuestion,
    turns,
  ])
}
