import { Bot, CornerDownLeft, PanelRightClose, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { CitationList } from '@/components/CitationList'
import { Button } from '@/components/ui/button'
import { QUESTION_CHIPS } from '@/lib/agentQuestions'
import type { AgentTurn, ProposedAction } from '@/types'

const TOOL_TRACE_LABELS: Record<string, string> = {
  get_portfolio_kpis: 'Kennzahlen gelesen',
  list_findings: 'Befunde gelistet',
  get_site_timeline: 'Projektverlauf geladen',
  get_rule_definition: 'Regeldefinition geladen',
  recall_session: 'Sitzung gelesen',
  search_decisions: 'Entscheidungen gesucht',
  search_corpus: 'Dokumentkorpus durchsucht',
  get_site_summary: 'Standortzusammenfassung gelesen',
  list_documents: 'Dokumente gelistet',
  extract_document: 'Dokument gelesen',
}

type AgentSidebarProps = {
  collapsed: boolean
  analysisId: number | null
  draft: string
  turns: AgentTurn[]
  actions: ProposedAction[]
  onToggle: () => void
  onDraftChange: (value: string) => void
  onSubmit: (question?: string) => void
  onRetry: (turnId: string) => void
  onConfirmAction: (actionId: number) => void
  onEvidenceSelect?: (evidenceId: string) => void
}

export function AgentSidebar({
  collapsed,
  analysisId,
  draft,
  turns,
  actions,
  onToggle,
  onDraftChange,
  onSubmit,
  onRetry,
  onConfirmAction,
  onEvidenceSelect,
}: AgentSidebarProps) {
  const pending = turns.some((turn) => turn.status === 'pending')
  const latestCompleteId = useMemo(
    () => [...turns].reverse().find((turn) => turn.status === 'complete')?.id,
    [turns],
  )

  if (collapsed) {
    return (
      <div className="flex h-dvh flex-col items-center border-l border-border bg-[var(--surface-raised)] py-4">
        <Bot className="size-5 text-primary" aria-hidden="true" />
        {pending && <span className="mt-2 size-2 rounded-full bg-muted-foreground" aria-label="Antwort ausstehend" />}
        <button
          type="button"
          className="mt-4 flex flex-1 items-start rounded-md px-2 py-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/40 [writing-mode:vertical-rl]"
          onClick={onToggle}
          aria-controls="evidence-agent"
          aria-expanded={false}
          aria-label="Agent öffnen"
        >
          Agent öffnen
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col border-l border-border bg-[var(--surface-raised)]">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
        <span className="flex size-8 items-center justify-center rounded-md bg-[var(--selection)] text-primary">
          <Bot className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">Evidenz-Copilot</h2>
          <p className="truncate text-[11px] text-muted-foreground">
            {analysisId ? `Lauf #${analysisId}, verankerte Antworten` : 'Kein Lauf ausgewählt'}
          </p>
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
          onClick={onToggle}
          aria-controls="evidence-agent"
          aria-expanded={true}
          aria-label="Agent einklappen"
        >
          <PanelRightClose className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-label="Agent-Unterhaltung">
        {turns.length === 0 && (
          <div className="space-y-4">
            <p className="max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
              Fragen Sie nach Befunden, Dokumenten oder nächsten Schritten. Der Copilot kann nur Entwürfe anlegen.
            </p>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-primary">Beispielfragen</summary>
              <div className="mt-2 space-y-1.5">
                {QUESTION_CHIPS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    disabled={!analysisId}
                    onClick={() => onSubmit(question)}
                    className="block w-full rounded-md border border-border px-3 py-2 text-left text-xs leading-relaxed hover:bg-muted disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </details>
          </div>
        )}

        <div className="space-y-7">
          {turns.map((turn) => {
            const proposedActions = actions.filter((action) =>
              (turn.result?.result.proposed_action_ids ?? []).includes(action.id),
            )
            return (
              <article key={turn.id} className="space-y-3 border-b border-border pb-6 last:border-0">
                <section
                  role="region"
                  aria-label="Nachricht von Sie"
                  className="ml-auto max-w-[85%] rounded-lg bg-[var(--message-user)] px-3 py-2.5"
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sie</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.question}</p>
                </section>

                <section
                  role="region"
                  aria-label="Antwort von Evidenz-Copilot"
                  className="mr-auto w-full rounded-lg border border-border bg-background px-3 py-3"
                >
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Evidenz-Copilot
                  </p>
                  {turn.status === 'pending' && (
                    <div className="space-y-2" aria-label="Antwort wird erstellt">
                      <span className="text-xs text-muted-foreground">Antwort wird erstellt</span>
                      <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
                    </div>
                  )}
                  {turn.status === 'error' && (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-[var(--critical)]">Antwort konnte nicht geladen werden.</p>
                      <Button size="sm" variant="outline" onClick={() => onRetry(turn.id)}>
                        <RotateCcw className="size-3.5" /> Wiederholen
                      </Button>
                    </div>
                  )}
                  {turn.status === 'complete' && turn.result && (
                    <>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {turn.result.result.answer}
                      </p>
                      <CitationList
                        citations={turn.result.result.citations ?? []}
                        onEvidenceSelect={onEvidenceSelect}
                      />
                      {proposedActions.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-border pt-3">
                          <p className="text-xs font-medium">Vorgeschlagene Aktionen</p>
                          {proposedActions.map((action) => (
                            <div key={action.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-xs">
                              <span className="truncate">{action.action_type} #{action.id}</span>
                              {action.status === 'draft' ? (
                                <Button size="sm" onClick={() => onConfirmAction(action.id)}>Freigeben</Button>
                              ) : (
                                <span className="text-muted-foreground">{action.status}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {turn.result.result.tool_trace.length > 0 && (
                        <details className="mt-3 text-xs text-muted-foreground">
                          <summary className="cursor-pointer font-medium">
                            Verwendete Werkzeuge ({turn.result.result.tool_trace.length})
                          </summary>
                          <ul className="mt-2 space-y-1 pl-4">
                            {turn.result.result.tool_trace.map((tool, index) => (
                              <li key={`${tool}-${index}`}>{TOOL_TRACE_LABELS[tool] ?? tool}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </>
                  )}
                </section>
              </article>
            )
          })}
        </div>
        <div className="sr-only" aria-live="polite">
          {latestCompleteId ? 'Antwort des Evidenz-Copiloten abgeschlossen.' : ''}
        </div>
      </div>

      <form
        className="shrink-0 border-t border-border bg-[var(--surface-raised)] p-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <label htmlFor="agent-question" className="sr-only">Frage an den Evidenz-Copiloten</label>
        <div className="relative">
          <textarea
            id="agent-question"
            value={draft}
            disabled={!analysisId}
            rows={3}
            maxLength={2000}
            placeholder="Frage zu diesem Analyse-Lauf"
            onChange={(event) => onDraftChange(event.target.value)}
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 pr-11 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
          />
          <button
            type="submit"
            aria-label="Frage senden"
            disabled={!analysisId || !draft.trim() || pending}
            className="absolute right-2 bottom-2 flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
          >
            <CornerDownLeft className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Keine externe Aktion wird ohne Freigabe ausgeführt.
        </p>
      </form>
    </div>
  )
}
