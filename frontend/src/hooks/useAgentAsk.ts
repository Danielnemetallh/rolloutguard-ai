import { useMutation } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { API_BASE } from '@/lib/api'
import { buildAgentQuestion } from '@/lib/pageContext'
import type { AgentResult, AgentTurn } from '../types'

function newTurnId() {
  return crypto.randomUUID?.() ?? `turn-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function newSessionId() {
  return crypto.randomUUID?.() ?? `session-${Date.now()}`
}

function parseApiError(text: string) {
  try {
    const body = JSON.parse(text) as {
      message?: string
      detail?: string | Array<{ msg?: string }>
    }
    if (typeof body.message === 'string' && body.message) return body.message
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail) && body.detail[0]?.msg) return body.detail[0].msg ?? text
  } catch {
    /* raw */
  }
  return text || 'Agent-Anfrage fehlgeschlagen.'
}

export type AgentSession = {
  id: string
  title: string
  analysisRunId: number
  turns: AgentTurn[]
}

export function useAgentAsk(analysisId: number | null) {
  const [question, setQuestion] = useState('')
  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  )

  const ensureSession = useCallback(() => {
    if (!analysisId) return null
    if (activeSession && activeSession.analysisRunId === analysisId) return activeSession
    const existing = sessions.find((s) => s.analysisRunId === analysisId)
    if (existing) {
      setActiveSessionId(existing.id)
      return existing
    }
    const session: AgentSession = {
      id: newSessionId(),
      title: 'Neuer Chat',
      analysisRunId: analysisId,
      turns: [],
    }
    setSessions((prev) => [session, ...prev])
    setActiveSessionId(session.id)
    return session
  }, [activeSession, analysisId, sessions])

  const askAgent = useMutation({
    mutationFn: async (args: {
      id: string
      sessionId: string
      analysisRunId: number
      question: string
    }) => {
      const res = await fetch(`${API_BASE}/api/assistant/queries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_run_id: args.analysisRunId,
          question: args.question,
        }),
      })
      if (!res.ok) throw new Error(parseApiError(await res.text()))
      return res.json() as Promise<AgentResult>
    },
    onSuccess: (data, vars) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === vars.sessionId
            ? {
                ...session,
                turns: session.turns.map((turn) =>
                  turn.id === vars.id
                    ? { ...turn, status: 'complete', result: data, errorMessage: undefined }
                    : turn,
                ),
              }
            : session,
        ),
      )
    },
    onError: (err, vars) => {
      const message = err instanceof Error ? err.message : 'Agent-Anfrage fehlgeschlagen.'
      setSessions((prev) =>
        prev.map((session) =>
          session.id === vars.sessionId
            ? {
                ...session,
                turns: session.turns.map((turn) =>
                  turn.id === vars.id ? { ...turn, status: 'error', errorMessage: message } : turn,
                ),
              }
            : session,
        ),
      )
    },
  })

  const submitQuestion = (override?: string, contextLabel?: string) => {
    const q = (override ?? question).trim()
    if (!analysisId || !q) return
    const session = ensureSession()
    if (!session) return
    if (session.turns.some((t) => t.status === 'pending')) return

    const id = newTurnId()
    const fullQuestion = contextLabel ? buildAgentQuestion(q, contextLabel) : q
    const displayQuestion = q

    setSessions((prev) =>
      prev.map((s) =>
        s.id === session.id
          ? {
              ...s,
              title: s.turns.length === 0 ? q.slice(0, 40) : s.title,
              turns: [
                ...s.turns,
                {
                  id,
                  analysisRunId: analysisId,
                  question: displayQuestion,
                  status: 'pending',
                },
              ],
            }
          : s,
      ),
    )
    setQuestion('')
    askAgent.mutate({
      id,
      sessionId: session.id,
      analysisRunId: analysisId,
      question: fullQuestion,
    })
  }

  const retryTurn = (turn: AgentTurn, contextLabel?: string) => {
    if (!analysisId || turn.status === 'pending' || !activeSession) return
    const fullQuestion = contextLabel
      ? buildAgentQuestion(turn.question, contextLabel)
      : turn.question
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              turns: s.turns.map((item) =>
                item.id === turn.id
                  ? { ...item, status: 'pending', errorMessage: undefined, result: undefined }
                  : item,
              ),
            }
          : s,
      ),
    )
    askAgent.mutate({
      id: turn.id,
      sessionId: activeSession.id,
      analysisRunId: analysisId,
      question: fullQuestion,
    })
  }

  const startNewChat = () => {
    if (!analysisId) return
    const session: AgentSession = {
      id: newSessionId(),
      title: 'Neuer Chat',
      analysisRunId: analysisId,
      turns: [],
    }
    setSessions((prev) => [session, ...prev])
    setActiveSessionId(session.id)
  }

  const selectSession = (id: string) => setActiveSessionId(id)

  const turns = activeSession?.turns ?? []
  const sessionsForRun = sessions.filter((s) => s.analysisRunId === analysisId)

  return {
    question,
    askPending: turns.some((t) => t.status === 'pending'),
    askError: turns.some((t) => t.status === 'error'),
    history: turns,
    sessions: sessionsForRun,
    activeSessionId,
    activeSessionTitle: activeSession?.title ?? 'Neuer Chat',
    questionChange: setQuestion,
    submitQuestion,
    retryTurn,
    startNewChat,
    selectSession,
  }
}
