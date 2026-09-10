import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { API_BASE } from '@/lib/api'
import { DEFAULT_QUESTION } from '@/lib/agentQuestions'
import type { AgentResult } from '../types'
import type { AgentTurn } from '@/components/AgentDock'

export function useAgentAsk(analysisId: number | null) {
  const [question, setQuestion] = useState<string>(DEFAULT_QUESTION)
  const [history, setHistory] = useState<AgentTurn[]>([])

  const askAgent = useMutation({
    mutationFn: async (args: { analysisRunId: number; question: string }) => {
      const res = await fetch(`${API_BASE}/api/assistant/queries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_run_id: args.analysisRunId,
          question: args.question,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<AgentResult>
    },
    onSuccess: (data, vars) => {
      setHistory((prev) => [...prev, { question: vars.question, result: data }])
    },
    onError: () => toast.error('Agent-Anfrage fehlgeschlagen'),
  })

  return {
    question,
    askPending: askAgent.isPending,
    askError: askAgent.isError,
    askResult: askAgent.data,
    history,
    questionChange: setQuestion,
    submitQuestion: (override?: string) => {
      const q = (override ?? question).trim()
      if (!analysisId || !q) return
      if (override) setQuestion(override)
      askAgent.mutate({ analysisRunId: analysisId, question: q })
    },
  }
}
