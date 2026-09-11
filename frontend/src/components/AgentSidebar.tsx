import { useRef } from 'react'
import {
  ArrowUp,
  ChevronDown,
  MessageSquarePlus,
  PanelRightClose,
  Plus,
  Settings2,
} from 'lucide-react'
import { CitationList } from '@/components/CitationList'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { ACTION_TYPE_LABELS, actionSummary } from '@/lib/actionLabels'
import { QUESTION_CHIPS } from '@/lib/agentQuestions'
import type { AgentSession } from '@/hooks/useAgentAsk'
import type { AgentTurn, IntegrationStatus, ProposedAction } from '../types'

type AgentSidebarProps = {
  onClose: () => void
  analysisId: number | null
  question: string
  pending: boolean
  history: AgentTurn[]
  sessions: AgentSession[]
  activeSessionTitle: string
  pageContextLabel: string
  actions: ProposedAction[]
  confirmPending: boolean
  dismissPending: boolean
  integrations: IntegrationStatus | undefined
  onQuestionChange: (value: string) => void
  onSubmit: (override?: string) => void
  onRetry: (turn: AgentTurn) => void
  onNewChat: () => void
  onSelectSession: (id: string) => void
  onConfirm: (id: number) => void
  onDismiss: (id: number) => void
  onConnect: () => void
  onUploadDocument?: (file: File) => void
}

export function AgentSidebar({
  onClose,
  analysisId,
  question,
  pending,
  history,
  sessions,
  activeSessionTitle,
  pageContextLabel,
  actions,
  confirmPending,
  dismissPending,
  integrations,
  onQuestionChange,
  onSubmit,
  onRetry,
  onNewChat,
  onSelectSession,
  onConfirm,
  onDismiss,
  onConnect,
  onUploadDocument,
}: AgentSidebarProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <aside
      id="evidence-agent"
      className="flex h-dvh min-h-0 flex-col border-l border-border bg-[var(--surface-raised)]"
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm font-medium"
            >
              <span className="truncate">{activeSessionTitle}</span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {sessions.length === 0 && (
              <DropdownMenuItem disabled>Keine früheren Chats</DropdownMenuItem>
            )}
            {sessions.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => onSelectSession(s.id)}>
                {s.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Neuer Chat" onClick={onNewChat}>
          <MessageSquarePlus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Agent schließen"
          onClick={onClose}
        >
          <PanelRightClose className="size-4" />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1 px-4 py-5">
        <div className="space-y-7" aria-live="polite">
          {!analysisId && (
            <p className="text-sm text-muted-foreground">
              Zuerst <strong>Analyse starten</strong>, dann Fragen zum Lauf stellen.
            </p>
          )}
          {analysisId && history.length === 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Beispielfragen</summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUESTION_CHIPS.map((q) => (
                  <Button
                    key={q}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => onSubmit(q)}
                    className="h-auto whitespace-normal text-left"
                  >
                    {q.length > 42 ? `${q.slice(0, 42)}…` : q}
                  </Button>
                ))}
              </div>
            </details>
          )}
          {history.map((turn) => (
            <article key={turn.id} className="space-y-3">
              <div
                className="ml-auto max-w-[85%] rounded-2xl bg-accent px-4 py-2.5"
                aria-label="Ihre Nachricht"
              >
                <p className="whitespace-pre-wrap text-sm">{turn.question}</p>
              </div>
              {turn.status === 'pending' && (
                <div className="space-y-2" aria-label="Agent-Antwort">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              )}
              {turn.status === 'error' && (
                <div>
                  <p className="text-sm text-[var(--warn)]">{turn.errorMessage}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => onRetry(turn)}
                  >
                    Erneut senden
                  </Button>
                </div>
              )}
              {turn.status === 'complete' && turn.result && (
                <AgentResponse
                  turn={turn}
                  actions={actions}
                  confirmPending={confirmPending}
                  dismissPending={dismissPending}
                  onConfirm={onConfirm}
                  onDismiss={onDismiss}
                />
              )}
            </article>
          ))}
        </div>
      </ScrollArea>

      <form
        className="shrink-0 border-t border-border bg-[var(--surface-raised)] p-4"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <div className="rounded-xl border border-border bg-card p-3">
          <textarea
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder={analysisId ? 'Frage zu diesem Analyse-Lauf…' : 'Analyse starten, dann fragen'}
            disabled={!analysisId || pending}
            rows={3}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSubmit()
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                {pageContextLabel}
              </span>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.xls,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file && onUploadDocument) onUploadDocument(file)
                  e.target.value = ''
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Dokument anhängen"
                disabled={!onUploadDocument}
                onClick={() => fileRef.current?.click()}
              >
                <Plus className="size-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Einstellungen">
                    <Settings2 className="size-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 text-sm">
                  <p className="font-medium">Integrationen</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {integrations?.connected
                      ? 'Composio verbunden'
                      : 'Composio nicht verbunden'}
                  </p>
                  {!integrations?.connected && (
                    <Button type="button" size="sm" className="mt-3 w-full" onClick={onConnect}>
                      Verbinden
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <Button
              type="submit"
              size="icon"
              className="rounded-full"
              disabled={!analysisId || pending || !question.trim()}
              aria-label="Senden"
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </div>
      </form>
    </aside>
  )
}

function AgentResponse({
  turn,
  actions,
  confirmPending,
  dismissPending,
  onConfirm,
  onDismiss,
}: {
  turn: AgentTurn
  actions: ProposedAction[]
  confirmPending: boolean
  dismissPending: boolean
  onConfirm: (id: number) => void
  onDismiss: (id: number) => void
}) {
  const result = turn.result!.result
  const proposed = (result.proposed_action_ids ?? [])
    .map((id) => actions.find((a) => a.id === id))
    .filter((a): a is ProposedAction => a != null)

  return (
    <div className="space-y-3" aria-label="Agent-Antwort">
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.answer}</p>
      <CitationList citations={result.citations} />
      {proposed.map((action) => (
        <div key={action.id} className="rounded-md border border-border bg-card/50 p-3">
          <p className="text-sm font-medium">
            {ACTION_TYPE_LABELS[action.action_type] ?? action.action_type}
          </p>
          <p className="text-xs text-muted-foreground">
            {action.status === 'draft' ? 'Entwurf' : action.status}
          </p>
          <p className="mt-1 text-sm">{actionSummary(action.payload)}</p>
          {action.status === 'draft' && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onDismiss(action.id)} disabled={dismissPending}>
                Verwerfen
              </Button>
              <Button size="sm" onClick={() => onConfirm(action.id)} disabled={confirmPending}>
                Freigeben
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
