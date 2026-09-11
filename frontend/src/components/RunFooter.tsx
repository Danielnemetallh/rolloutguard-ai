import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AnalysisSummary, Diff } from '../types'

type RunFooterProps = {
  diff: Diff | undefined
  analyses: AnalysisSummary[] | undefined
  analysisId: number | null
  onSelectRun: (id: number) => void
}

export function RunFooter({ diff, analyses, analysisId, onSelectRun }: RunFooterProps) {
  const hasDiff = diff?.compared_to_run_id != null

  return (
    <div className="flex min-h-10 flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
      <p>
        {hasDiff
          ? `Seit Lauf #${diff!.compared_to_run_id}: ${diff!.new_count} neu · ${diff!.resolved_count} erledigt · ${diff!.persisting_count} unverändert`
          : 'Erster Lauf oder kein Vergleich verfügbar'}
      </p>
      {analyses && analyses.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="uppercase tracking-wider">Lauf</span>
          <Select
            value={analysisId != null ? String(analysisId) : undefined}
            onValueChange={(v) => onSelectRun(Number(v))}
          >
            <SelectTrigger className="h-8 w-[10rem]" size="sm">
              <SelectValue placeholder="Lauf wählen" />
            </SelectTrigger>
            <SelectContent>
              {analyses.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  #{a.id}
                  {a.created_at
                    ? ` · ${new Date(a.created_at).toLocaleString('de-DE', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
