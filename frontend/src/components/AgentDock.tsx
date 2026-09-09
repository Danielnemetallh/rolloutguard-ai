import { Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { EvidenceChips } from '@/components/EvidenceChips'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { QUESTION_CHIPS } from '@/lib/agentQuestions'
import type { AgentResult } from '../types'

const TOOL_TRACE_LABELS: Record<string, string> = {
  get_portfolio_kpis: 'Kennzahlen gelesen',
  list_findings: 'Befunde gelistet',
  get_site_timeline: 'Timeline geladen',
  get_rule_definition: 'Regeldefinition geladen',
}

type AgentDockProps = {
  analysisId: number | null
  question: string
  pending: boolean
  error: boolean
  result: AgentResult | undefined
  onQuestionChange: (value: string) => void
  onSubmit: () => void
  onEvidenceSelect?: (id: string) => void
}

export function AgentDock({
  analysisId,
  question,
  pending,
  error,
  result,
  onQuestionChange,
  onSubmit,
  onEvidenceSelect,
}: AgentDockProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex w-[min(100vw-2rem,24rem)] max-h-[min(70vh,32rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-heading text-sm font-semibold">Agent fragen</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="Schließen"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
          <div className="space-y-3 overflow-auto p-4">
            <p className="text-sm text-muted-foreground">
              Nur lesen — der Agent fragt KPIs, Befunde und Timelines ab. Er ändert keine Daten.
            </p>
            <div className="flex flex-wrap gap-2">
              {QUESTION_CHIPS.map((q) => (
                <Button
                  key={q}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!analysisId || pending}
                  onClick={() => onQuestionChange(q)}
                  className="h-auto whitespace-normal text-left"
                >
                  {q.length > 42 ? `${q.slice(0, 42)}…` : q}
                </Button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                onSubmit()
              }}
            >
              <Input
                type="text"
                value={question}
                onChange={(e) => onQuestionChange(e.target.value)}
                placeholder="Frage zu diesem Analyse-Lauf…"
                disabled={!analysisId}
                className="flex-1"
              />
              <Button type="submit" disabled={!analysisId || pending || !question.trim()}>
                {pending ? 'Frage…' : 'Fragen'}
              </Button>
            </form>
            {error && (
              <p className="text-sm text-[var(--warn)]">Agent-Anfrage fehlgeschlagen.</p>
            )}
            {result && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <p className="whitespace-pre-wrap leading-relaxed">{result.result.answer}</p>
                {result.result.tool_trace.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Tool-Ablauf
                    </p>
                    <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                      {result.result.tool_trace.map((t) => (
                        <li key={t}>{TOOL_TRACE_LABELS[t] ?? t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <EvidenceChips ids={result.result.evidence_ids} onSelect={onEvidenceSelect} />
              </div>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-expanded={open}
        aria-label={open ? 'Agent schließen' : 'Agent öffnen'}
      >
        {open ? <X className="size-6" strokeWidth={2} /> : <Sparkles className="size-6" strokeWidth={2} />}
      </button>
    </div>
  )
}
