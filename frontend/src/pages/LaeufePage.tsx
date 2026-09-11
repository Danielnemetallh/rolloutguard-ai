import { KpiStrip } from '@/components/KpiStrip'
import { PageHeader } from '@/components/PageHeader'
import { RunFooter } from '@/components/RunFooter'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useWorkbench } from '@/context/WorkbenchContext'

export function LaeufePage() {
  const wb = useWorkbench()

  return (
    <div className="space-y-5">
      <PageHeader title="Läufe" description="Analysehistorie und Laufvergleich." />
      <section className="border border-border bg-[var(--surface-raised)]">
        <KpiStrip kpis={wb.kpis} />
        <RunFooter
          diff={wb.diff}
          analyses={wb.analyses}
          analysisId={wb.analysisId}
          onSelectRun={wb.onSelectRun}
        />
      </section>
      <div className="overflow-hidden rounded-lg border border-border bg-[var(--surface-raised)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lauf</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Kritisch</TableHead>
              <TableHead>Warnungen</TableHead>
              <TableHead>Erstellt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(wb.analyses ?? []).map((a) => (
              <TableRow
                key={a.id}
                className="cursor-pointer"
                data-state={wb.analysisId === a.id ? 'selected' : undefined}
                onClick={() => wb.onSelectRun(a.id)}
              >
                <TableCell className="font-mono">#{a.id}</TableCell>
                <TableCell>{a.status}</TableCell>
                <TableCell className="text-[var(--critical)]">
                  {a.kpis?.findings_critical ?? 'k. A.'}
                </TableCell>
                <TableCell className="text-[var(--warn)]">
                  {a.kpis?.findings_warning ?? 'k. A.'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {a.created_at
                    ? new Date(a.created_at).toLocaleString('de-DE')
                    : 'k. A.'}
                </TableCell>
              </TableRow>
            ))}
            {!wb.analyses?.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Noch keine Analyseläufe. Starte eine Analyse im Leitstand.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
