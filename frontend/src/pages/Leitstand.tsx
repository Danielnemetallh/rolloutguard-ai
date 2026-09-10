import { Link } from 'react-router-dom'
import { ActionsQueue } from '@/components/ActionsQueue'
import { QueueWorkspace } from '@/components/QueueWorkspace'
import { RunStrip } from '@/components/RunStrip'
import { useWorkbench } from '@/context/workbench'

export function Leitstand() {
  const workbench = useWorkbench()

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em]">Leitstand</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Priorisierte Abweichungen aus Vertrag, Terminplan und Standortstatus.
          </p>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {workbench.analysisId ? `Aktiver Lauf #${workbench.analysisId}` : 'Noch kein Lauf'}
        </p>
      </header>

      <RunStrip
        kpis={workbench.kpis}
        diff={workbench.diff}
        analyses={workbench.analyses}
        analysisId={workbench.analysisId}
        onSelectRun={workbench.onSelectRun}
      />

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <QueueWorkspace compact />
        <div className="space-y-3">
          <ActionsQueue
            compact
            actions={workbench.actions}
            loading={workbench.actionsLoading}
            error={workbench.actionsError}
            mutationPending={workbench.actionMutationPending}
            onConfirm={workbench.confirmAction}
            onDismiss={workbench.dismissAction}
            onRetry={workbench.retryActions}
          />
          <Link to="/aktionen" className="block text-right text-xs font-medium text-primary hover:underline">
            Alle Aktionen öffnen
          </Link>
        </div>
      </div>
    </div>
  )
}
