import { useState } from 'react'
import type { AgentResult } from '../types'

type AgentDockProps = {
  analysisId: number | null
  question: string
  pending: boolean
  error: boolean
  result: AgentResult | undefined
  onQuestionChange: (value: string) => void
  onSubmit: () => void
}

export function AgentDock({
  analysisId,
  question,
  pending,
  error,
  result,
  onQuestionChange,
  onSubmit,
}: AgentDockProps) {
  const [open, setOpen] = useState(false)

  return (
    <section className="agent-dock" aria-label="Agent">
      <button
        type="button"
        className="agent-dock-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Ask the agent</span>
        <span className={`agent-dock-chevron ${open ? 'open' : ''}`} aria-hidden="true">
          ▼
        </span>
      </button>
      {open && (
        <div className="agent-dock-body">
          <p className="agent-dock-note">
            Read-only. The agent queries KPIs, findings, and timelines. It never changes data.
          </p>
          <form
            className="agent-form"
            onSubmit={(e) => {
              e.preventDefault()
              onSubmit()
            }}
          >
            <input
              type="text"
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              placeholder="Ask about this analysis run…"
              disabled={!analysisId}
            />
            <button
              type="submit"
              disabled={!analysisId || pending || !question.trim()}
            >
              {pending ? 'Asking…' : 'Ask'}
            </button>
          </form>
          {error && <p className="warn status-inline">Agent query failed.</p>}
          {result && <pre className="agent-answer">{result.result.answer}</pre>}
        </div>
      )}
    </section>
  )
}
