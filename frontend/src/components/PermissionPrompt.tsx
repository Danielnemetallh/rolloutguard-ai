import { Button } from '@/components/ui/button'
import { actionStatusLabel } from '@/lib/labels'
import type { ProposedAction } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  calendar: 'Kalender',
  email: 'E-Mail',
  briefing: 'Briefing',
  digest: 'Digest',
  board: 'Notion',
  task: 'Aufgabe',
  override: 'Override',
  watch: 'Watch',
}

function summary(action: ProposedAction) {
  const payload = action.payload
  return String(
    payload.title ?? payload.subject ?? payload.summary ?? payload.message ?? 'Aktion',
  )
}

type PermissionPromptProps = {
  actions: ProposedAction[]
  mutationPending?: boolean
  onConfirm: (id: number) => void
  onDismiss: (id: number) => void
}

export function PermissionPrompt({
  actions,
  mutationPending = false,
  onConfirm,
  onDismiss,
}: PermissionPromptProps) {
  const pending = actions.filter((action) => action.status === 'draft')
  if (pending.length === 0) return null

  return (
    <div
      className="mx-4 mb-1 rounded-lg border border-primary/30 bg-[var(--selection)] px-3 py-3"
      role="dialog"
      aria-label="Freigabe erforderlich"
    >
      <p className="text-xs font-semibold">Freigabe erforderlich</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Composio führt die Aktion erst aus, wenn Sie zustimmen.
      </p>
      <ul className="mt-2 space-y-2">
        {pending.map((action) => (
          <li key={action.id} className="rounded-md border border-border bg-[var(--surface-raised)] px-2.5 py-2">
            <p className="text-xs font-medium">
              {TYPE_LABELS[action.action_type] ?? action.action_type}
              <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                {actionStatusLabel(action.status)}
              </span>
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{summary(action)}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={mutationPending} onClick={() => onConfirm(action.id)}>
                Erlauben
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={mutationPending}
                onClick={() => onDismiss(action.id)}
              >
                Ablehnen
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
