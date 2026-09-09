import { Link } from 'react-router-dom'
import { Mark } from '@/components/Mark'
import { Button } from '@/components/ui/button'

type TopBarProps = {
  isLoading: boolean
  error: Error | null
  analysisId: number | null
  projectId: number | undefined
  analyzePending: boolean
  exportPending: boolean
  onAnalyze: () => void
  onExport: () => void
}

export function TopBar({
  isLoading,
  error,
  analysisId,
  projectId,
  analyzePending,
  exportPending,
  onAnalyze,
  onExport,
}: TopBarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
      <Link to="/" className="flex min-w-0 items-center gap-2.5 text-inherit no-underline">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/5 text-primary">
          <Mark />
        </span>
        <div>
          <p className="font-heading text-lg font-medium leading-none tracking-tight text-foreground">
            RolloutGuard
          </p>
          <p className="mt-1 text-xs leading-none text-muted-foreground">
            Ausnahmen statt Dauerprüfung
          </p>
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        {isLoading && <span className="text-sm text-muted-foreground">Verbinde…</span>}
        {error && (
          <span className="text-sm text-[var(--warn)]">
            API offline — <code className="font-mono text-xs">scripts/dev-api.ps1</code>
          </span>
        )}
        <Button
          type="button"
          disabled={!projectId || analyzePending}
          onClick={onAnalyze}
          className="rounded-full"
        >
          {analyzePending ? 'Analysiere…' : 'Analyse starten'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!analysisId || exportPending}
          onClick={onExport}
        >
          {exportPending ? 'Exportiere…' : 'Export'}
        </Button>
      </div>
    </header>
  )
}
