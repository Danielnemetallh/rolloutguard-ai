import { ActionsQueue } from '@/components/ActionsQueue'
import { useWorkbench } from '@/context/workbench'

export function ActionsPage() {
  const workbench = useWorkbench()
  const statusCounts = workbench.actions.reduce<Record<string, number>>((counts, action) => {
    counts[action.status] = (counts[action.status] ?? 0) + 1
    return counts
  }, {})

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em]">Aktionen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entwürfe bleiben inaktiv, bis eine Person sie ausdrücklich freigibt.
          </p>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {Object.entries(statusCounts).map(([status, count]) => `${count} ${status}`).join(', ') || '0 Aktionen'}
        </p>
      </header>
      <ActionsQueue
        actions={workbench.actions}
        loading={workbench.actionsLoading}
        error={workbench.actionsError}
        mutationPending={workbench.actionMutationPending}
        onConfirm={workbench.confirmAction}
        onDismiss={workbench.dismissAction}
        onRetry={workbench.retryActions}
      />
    </div>
  )
}
