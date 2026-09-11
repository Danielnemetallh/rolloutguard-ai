import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useWorkbench } from '@/context/WorkbenchContext'
import { ACTION_STATUS_LABELS, ACTION_TYPE_LABELS, actionSummary } from '@/lib/actionLabels'
import { cn } from '@/lib/utils'

export function ActionsPage() {
  const wb = useWorkbench()

  return (
    <div className="space-y-5">
      <PageHeader
        title="Aktionen"
        description="Entwürfe aus dem Agenten. Freigeben führt die externe Aktion aus."
      />
      {wb.actions.length === 0 && (
        <p className="text-sm text-muted-foreground">Keine Aktionen. Der Agent oder der Inspektor legt Entwürfe an.</p>
      )}
      <ul className="space-y-2">
        {wb.actions.map((action) => (
          <li key={action.id} className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {ACTION_TYPE_LABELS[action.action_type] ?? action.action_type} #{action.id}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ACTION_STATUS_LABELS[action.status] ?? action.status}
                  {(action.site_ids ?? []).length ? ` · ${action.site_ids.join(', ')}` : ''}
                </p>
                <p className="mt-1 text-sm">{actionSummary(action.payload)}</p>
                {action.result && Object.keys(action.result).length > 0 && (
                  <p className={cn('mt-2 font-mono text-xs', action.status === 'failed' && 'text-[var(--warn)]')}>
                    {String(action.result.channel ?? '')}
                    {action.result.tool ? ` · ${String(action.result.tool)}` : ''}
                    {action.result.path ? ` · ${String(action.result.path)}` : ''}
                    {action.result.note ? ` · ${String(action.result.note)}` : ''}
                  </p>
                )}
              </div>
              {action.status === 'draft' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => wb.onDismissAction(action.id)}
                    disabled={wb.dismissPending}
                  >
                    Verwerfen
                  </Button>
                  <Button size="sm" onClick={() => wb.onConfirmAction(action.id)} disabled={wb.confirmPending}>
                    Freigeben
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
