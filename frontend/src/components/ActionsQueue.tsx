import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { actionStatusLabel } from '@/lib/labels'
import type { ProposedAction } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  calendar: 'Kalender',
  email: 'E-Mail',
  briefing: 'Briefing',
  digest: 'Digest',
  board: 'Karte',
  task: 'Aufgabe',
  override: 'Override',
  watch: 'Watch',
  watch_fire: 'Watch-Erinnerung',
}

type ActionsQueueProps = {
  actions: ProposedAction[]
  loading?: boolean
  error?: boolean
  compact?: boolean
  mutationPending?: boolean
  onConfirm: (id: number) => void
  onDismiss: (id: number) => void
  onRetry: () => void
}

function actionSummary(action: ProposedAction) {
  return String(
    action.payload.title ?? action.payload.subject ?? action.payload.message ?? 'Kein Betreff',
  )
}

export function ActionsQueue({
  actions,
  loading = false,
  error = false,
  compact = false,
  mutationPending = false,
  onConfirm,
  onDismiss,
  onRetry,
}: ActionsQueueProps) {
  const visibleActions = compact
    ? actions.filter((action) => action.status === 'draft').slice(0, 3)
    : actions

  return (
    <section
      className="overflow-hidden border border-border bg-[var(--surface-raised)]"
      aria-label="Aktionsqueue"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Aktionsqueue</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {actions.filter((action) => action.status === 'draft').length} offen
        </span>
      </header>
      {loading && (
        <div
          className="m-4 h-14 animate-pulse rounded bg-muted"
          aria-label="Aktionen werden geladen"
        />
      )}
      {error && (
        <div className="m-4 flex items-center justify-between gap-3 text-sm text-[var(--critical)]">
          <span>Aktionen konnten nicht geladen werden.</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="size-3.5" /> Wiederholen
          </Button>
        </div>
      )}
      {!loading && !error && visibleActions.length === 0 && (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Keine Aktionen in dieser Ansicht.
        </p>
      )}
      {!loading && !error && visibleActions.length > 0 && (
        <div className="divide-y divide-border">
          {visibleActions.map((action) => (
            <div
              key={action.id}
              className="grid min-h-14 gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {TYPE_LABELS[action.action_type] ?? action.action_type} #{action.id}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {actionStatusLabel(action.status)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {(action.site_ids ?? []).join(', ') || 'Ohne Standort'}: {actionSummary(action)}
                </p>
              </div>
              {action.status === 'draft' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={mutationPending}
                    onClick={() => onConfirm(action.id)}
                  >
                    Freigeben
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutationPending}
                    onClick={() => onDismiss(action.id)}
                  >
                    Verwerfen
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="border-t border-border bg-[var(--surface-subtle)] px-4 py-2 text-[11px] text-muted-foreground">
        Keine externe Aktion wird ohne Freigabe ausgeführt.
      </p>
    </section>
  )
}
