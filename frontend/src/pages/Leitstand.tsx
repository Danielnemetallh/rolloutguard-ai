import { useNavigate } from 'react-router-dom'
import { ActionsQueue } from '@/components/ActionsQueue'
import { Queue } from '@/components/Queue'
import { RunStrip } from '@/components/RunStrip'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useWorkbench } from '@/context/WorkbenchContext'
import { timelineLabel } from '@/lib/labels'

export function Leitstand() {
  const wb = useWorkbench()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <RunStrip
        kpis={wb.kpis}
        diff={wb.diff}
        analyses={wb.analyses}
        analysisId={wb.analysisId}
        onSelectRun={wb.onSelectRun}
      />
      <div
        className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) wb.onUploadDocument(file)
        }}
      >
        PDF, DOCX oder Text hier ablegen — oder oben „Dokumente“ wählen.
        {wb.documents.length > 0 && (
          <span className="ml-2 text-foreground">
            {wb.documents.map((d) => d.filename).join(', ')}
          </span>
        )}
      </div>
      {wb.pendingMappings.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Spaltenzuordnungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {wb.pendingMappings.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <p>
                  <span className="font-mono text-xs">{m.filename}</span>
                  {': '}
                  {m.source_header}
                  {' → '}
                  {m.canonical_field ? timelineLabel(m.canonical_field) : 'unbekannt'}
                </p>
                <Button size="sm" onClick={() => wb.onApproveMapping(m.id)}>
                  Bestätigen
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <ActionsQueue projectId={wb.projectId} />
      <Queue
        analysisId={wb.analysisId}
        findings={wb.visibleFindings}
        totalCount={wb.totalCount}
        visibleCount={wb.visibleFindings.length}
        search={wb.search}
        severity={wb.severity}
        sortKey={wb.sortKey}
        sortDir={wb.sortDir}
        heroFindings={wb.heroFindings}
        showHeroHints={wb.showHeroHints}
        onSearchChange={wb.onSearchChange}
        onSeverityChange={wb.onSeverityChange}
        onToggleSort={wb.onToggleSort}
        onSelect={(f) => {
          wb.resetExplain()
          void navigate(`/befund/${f.id}`)
        }}
        onHeroSelect={(hero) => {
          const match = wb.matchHeroFinding(hero)
          if (match) {
            wb.resetExplain()
            void navigate(`/befund/${match.id}`)
          }
        }}
      />
    </div>
  )
}
