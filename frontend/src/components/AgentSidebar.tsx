import { Bot, CornerDownLeft, Crosshair, History, Paperclip, RotateCcw, Square, SquarePen, X } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { AgentSessionHistory } from '@/components/AgentSessionHistory'
import { CitationList } from '@/components/CitationList'
import { PermissionPrompt } from '@/components/PermissionPrompt'
import { Button } from '@/components/ui/button'
import type { AgentViewportContext } from '@/hooks/useAgentViewportContext'
import { starterPrompts } from '@/lib/agentQuestions'
import type { AgentSessionSummary, AgentTurn, ProposedAction } from '@/types'

type AgentSidebarProps = {
  collapsed: boolean
  analysisId: number | null
  draft: string
  turns: AgentTurn[]
  actions: ProposedAction[]
  onToggle: () => void
  onNewSession?: () => void
  onShowHistory?: () => void
  historyOpen?: boolean
  savedSessions?: AgentSessionSummary[]
  onResumeSession?: (sessionId: string) => void
  onDeleteSession?: (sessionId: string) => void
  onRenameSession?: (sessionId: string, title: string) => void
  onCloseHistory?: () => void
  viewport?: AgentViewportContext
  onDraftChange: (value: string) => void
  onSubmit: (question?: string) => void
  onRetry: (turnId: string) => void
  onStop?: () => void
  onConfirmAction: (actionId: number) => void
  onDismissAction?: (actionId: number) => void
  actionMutationPending?: boolean
  projectId?: number
  uploadPending?: boolean
  onUploadDocument?: (file: File) => void
  onEvidenceSelect?: (evidenceId: string) => void
}

export function AgentSidebar({
  collapsed,
  analysisId,
  draft,
  turns,
  actions,
  onToggle,
  onNewSession,
  onShowHistory,
  historyOpen = false,
  savedSessions = [],
  onResumeSession,
  onDeleteSession,
  onRenameSession,
  onCloseHistory,
  viewport,
  onDraftChange,
  onSubmit,
  onRetry,
  onStop,
  onConfirmAction,
  onDismissAction,
  actionMutationPending = false,
  projectId,
  uploadPending = false,
  onUploadDocument,
  onEvidenceSelect,
}: AgentSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pending = turns.some((turn) => turn.status === 'pending')
  const latestCompleteId = useMemo(
    () => [...turns].reverse().find((turn) => turn.status === 'complete')?.id,
    [turns],
  )
  const attachTitle = uploadPending
    ? 'Dokument wird gelesen…'
    : 'Dokument in den Korpus aufnehmen (nicht an diese Nachricht)'

  if (collapsed) {
    return (
      <button
        type="button"
        className="agent-launcher"
        onClick={onToggle}
        aria-controls="evidence-agent"
        aria-expanded={false}
        aria-label="Evidenz-Copilot öffnen"
      >
        <Bot className="size-5 text-primary" aria-hidden="true" />
        {pending && (
          <span className="agent-launcher-badge" aria-label="Antwort ausstehend" />
        )}
      </button>
    )
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col border-l border-border bg-[var(--surface-raised)]">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <span className="flex size-8 items-center justify-center rounded-md bg-[var(--selection)] text-primary">
          <Bot className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">Evidenz-Copilot</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40"
            onClick={onNewSession}
            disabled={!analysisId || !onNewSession}
            aria-label="Neue Sitzung"
            title="Neue Sitzung"
          >
            <SquarePen className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40"
            onClick={onShowHistory}
            disabled={!analysisId || !onShowHistory}
            aria-label="Sitzungsverlauf"
            title="Sitzungsverlauf"
          >
            <History className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={onToggle}
            aria-controls="evidence-agent"
            aria-expanded={true}
            aria-label="Evidenz-Copilot schließen"
            title="Schließen"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {historyOpen ? (
        <AgentSessionHistory
          sessions={savedSessions}
          onResume={onResumeSession}
          onRename={onRenameSession}
          onDelete={onDeleteSession}
          onClose={onCloseHistory}
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-label="Agent-Unterhaltung">
            {turns.length === 0 && (
              <div className="space-y-3">
                <p className="max-w-[34ch] text-sm leading-relaxed text-muted-foreground">
                  Fragen Sie nach Befunden, Dokumenten, Kalender oder nächsten Schritten.
                </p>
                {analysisId != null && (
                  <ul className="flex flex-wrap gap-1.5">
                    {starterPrompts(viewport).map((prompt) => (
                      <li key={prompt}>
                        <button
                          type="button"
                          onClick={() => onSubmit(prompt)}
                          className="max-w-full rounded-full border border-border bg-[var(--surface-subtle)] px-2.5 py-1 text-left text-[11px] leading-snug text-muted-foreground hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                        >
                          {prompt}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
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
                      className="ml-auto max-w-[88%] border-r-2 border-primary bg-[var(--message-user)] px-3 py-2.5"
                    >
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sie</p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.question}</p>
                    </section>

                    <section
                      role="region"
                      aria-label="Antwort von Evidenz-Copilot"
                      className="mr-auto w-full px-1 py-2"
                    >
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Evidenz-Copilot
                      </p>
                      {turn.status === 'pending' && (
                        <div className="space-y-2" aria-label="Antwort wird erstellt">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-muted-foreground">Antwort wird erstellt</span>
                            {onStop && (
                              <Button type="button" size="sm" variant="outline" onClick={onStop}>
                                <Square className="size-3.5 fill-current" aria-hidden="true" /> Anhalten
                              </Button>
                            )}
                          </div>
                          <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                          <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
                        </div>
                      )}
                      {turn.status === 'cancelled' && (
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm text-muted-foreground">Antwort angehalten.</p>
                          <Button size="sm" variant="outline" onClick={() => onRetry(turn.id)}>
                            <RotateCcw className="size-3.5" /> Wiederholen
                          </Button>
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
                          {turn.result.result.abstained && (
                            <Button size="sm" variant="outline" className="mt-2" onClick={() => onRetry(turn.id)}>
                              <RotateCcw className="size-3.5" /> Wiederholen
                            </Button>
                          )}
                          <CitationList
                            citations={turn.result.result.citations ?? []}
                            onEvidenceSelect={onEvidenceSelect}
                          />
                          {proposedActions.length > 0 && (
                            <p className="mt-3 text-xs text-muted-foreground">
                              {proposedActions.some((action) => action.status === 'draft')
                                ? 'Freigabe unten in der Seitenleiste.'
                                : proposedActions.map((action) => `${action.action_type}: ${action.status}`).join(' · ')}
                            </p>
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

          <PermissionPrompt
            actions={actions}
            mutationPending={actionMutationPending}
            onConfirm={onConfirmAction}
            onDismiss={onDismissAction ?? (() => undefined)}
          />

          <form
            className="shrink-0 bg-[var(--surface-raised)] p-4 pt-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (pending) {
                onStop?.()
                return
              }
              onSubmit()
            }}
          >
            <label htmlFor="agent-question" className="sr-only">Frage an den Evidenz-Copiloten</label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt,.md,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) onUploadDocument?.(file)
                event.target.value = ''
              }}
            />
            <div className="flex flex-col gap-2 rounded-xl border border-input bg-background px-2.5 py-2 focus-within:ring-2 focus-within:ring-ring/35">
              {viewport?.label && (
                <div className="px-0.5">
                  <span
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] text-muted-foreground"
                    title={viewport.label}
                  >
                    <Crosshair className="size-3 shrink-0 text-primary" aria-hidden="true" />
                    <span className="truncate">{viewport.label}</span>
                  </span>
                </div>
              )}
              <textarea
                id="agent-question"
                value={draft}
                disabled={!analysisId}
                rows={3}
                maxLength={2000}
                placeholder="Frage zu diesem Analyse-Lauf"
                onChange={(event) => onDraftChange(event.target.value)}
                className="min-h-[4.5rem] w-full resize-none border-0 bg-transparent px-1 py-0.5 text-sm leading-relaxed focus-visible:outline-none"
              />
              <div className="flex items-center justify-between gap-2 px-0.5">
                <button
                  type="button"
                  aria-label="Dokument in den Korpus aufnehmen"
                  title={attachTitle}
                  disabled={!projectId || uploadPending || !onUploadDocument}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <Paperclip className="size-4" aria-hidden="true" />
                </button>
                {pending ? (
                  <button
                    type="button"
                    aria-label="Antwort anhalten"
                    onClick={onStop}
                    disabled={!onStop}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
                  >
                    <Square className="size-3.5 fill-current" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    aria-label="Frage senden"
                    disabled={!analysisId || !draft.trim()}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
                  >
                    <CornerDownLeft className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
