import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { apiFetch, describeApiError } from '@/lib/api'
import { DEFAULT_QUESTION } from '@/lib/agentQuestions'
import type { AgentResult } from '../types'

export function useAgentAsk(analysisId: number | null) {
  const [question, setQuestion] = useState<string>(DEFAULT_QUESTION)
  const [lastQuestion, setLastQuestion] = useState('')

  const askAgent = useMutation({
    mutationFn: (args: { analysisRunId: number; question: string }) =>
      apiFetch<AgentResult>('/api/assistant/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_run_id: args.analysisRunId,
          question: args.question,
        }),
      }),
    onError: (error) => toast.error(describeApiError(error)),
  })

  const submitQuestion = (submittedQuestion: string) => {
    if (!analysisId || askAgent.isPending || !submittedQuestion.trim()) return
    const normalizedQuestion = submittedQuestion.trim()
    setLastQuestion(normalizedQuestion)
    askAgent.mutate({ analysisRunId: analysisId, question: normalizedQuestion })
  }

  return {
    question,
    lastQuestion,
    askPending: askAgent.isPending,
    askError: askAgent.error ?? null,
    askResult: askAgent.data,
    questionChange: setQuestion,
    submitQuestion: () => submitQuestion(question),
    retryQuestion: () => submitQuestion(lastQuestion),
  }
}
