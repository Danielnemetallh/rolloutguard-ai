import { Play, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QueueWorkspace } from '@/components/QueueWorkspace'
import { RunStrip } from '@/components/RunStrip'
import { useWorkbench } from '@/context/workbench'

export function Leitstand() {
  const workbench = useWorkbench()

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Portfolio · Ausnahmeprüfung</p>
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em]">Leitstand</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Priorisierte Abweichungen aus Vertrag, Terminplan und Standortstatus.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-xs text-muted-foreground">
            {workbench.analysisId ? `Aktiver Lauf #${workbench.analysisId}` : 'Noch kein Lauf'}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={!workbench.projectId || workbench.analyzePending}
            onClick={workbench.onAnalyze}
          >
            <Play className="size-4" />
            {workbench.analyzePending ? 'Analysiere…' : 'Analyse starten'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!workbench.analysisId || workbench.exportPending}
            onClick={workbench.onExport}
          >
            <Share className="size-4" />
            {workbench.exportPending ? 'Exportiere…' : 'Export'}
          </Button>
        </div>
      </header>

      <RunStrip
        kpis={workbench.kpis}
        diff={workbench.diff}
        analyses={workbench.analyses}
        analysisId={workbench.analysisId}
        onSelectRun={workbench.onSelectRun}
      />

      <QueueWorkspace compact />
    </div>
  )
}
