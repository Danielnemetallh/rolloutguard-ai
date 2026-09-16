import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { AgentSessionSummary } from '@/types'

type AgentSessionHistoryProps = {
  sessions: AgentSessionSummary[]
  onResume?: (sessionId: string) => void
  onRename?: (sessionId: string, title: string) => void
  onDelete?: (sessionId: string) => void
  onClose?: () => void
}

export function AgentSessionHistory({
  sessions,
  onResume,
  onRename,
  onDelete,
  onClose,
}: AgentSessionHistoryProps) {
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const finishRename = (sessionId: string) => {
    if (renameDraft.trim()) onRename?.(sessionId, renameDraft)
    setRenamingSessionId(null)
    setRenameDraft('')
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5" aria-label="Gespeicherte Sitzungen">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium">Sitzungsverlauf</p>
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            Schließen
          </button>
        </div>
        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Noch keine gespeicherten Sitzungen.</p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((session) => (
              <li
                key={session.session_id}
                className="group flex items-start gap-1 rounded-md px-1 py-1 hover:bg-muted/60"
              >
                {renamingSessionId === session.session_id ? (
                  <input
                    type="text"
                    value={renameDraft}
                    maxLength={200}
                    autoFocus
                    aria-label="Sitzung umbenennen"
                    className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        finishRename(session.session_id)
                      }
                      if (event.key === 'Escape') {
                        setRenamingSessionId(null)
                        setRenameDraft('')
                      }
                    }}
                    onBlur={() => finishRename(session.session_id)}
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      className="min-w-0 flex-1 px-1 py-1.5 text-left hover:text-primary"
                      onClick={() => onResume?.(session.session_id)}
                    >
                      <span className="block truncate text-xs">{session.preview || 'Leere Sitzung'}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {session.turn_count} {session.turn_count === 1 ? 'Frage' : 'Fragen'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40"
                      aria-label="Sitzung umbenennen"
                      title="Umbenennen"
                      onClick={(event) => {
                        event.stopPropagation()
                        setPendingDeleteId(null)
                        setRenamingSessionId(session.session_id)
                        setRenameDraft(session.preview || '')
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    {pendingDeleteId === session.session_id ? (
                      <button
                        type="button"
                        className="shrink-0 rounded-md px-1.5 py-1 text-[10px] font-medium text-[var(--critical)] hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
                        onClick={(event) => {
                          event.stopPropagation()
                          onDelete?.(session.session_id)
                          setPendingDeleteId(null)
                        }}
                      >
                        Löschen?
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-[var(--critical)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40"
                        aria-label="Sitzung löschen"
                        title="Löschen"
                        onClick={(event) => {
                          event.stopPropagation()
                          setPendingDeleteId(session.session_id)
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
