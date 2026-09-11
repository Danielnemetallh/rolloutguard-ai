import { Fragment } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { SelectedFindingTimeline } from '@/components/SelectedFindingTimeline'
import { severityBadgeVariant, severityLabel, statusLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Finding, HeroFinding, SortKey, Timeline } from '../types'

type QueueProps = {
  analysisId: number | null
  findings: Finding[]
  totalCount: number | undefined
  visibleCount: number
  search: string
  severity: string
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  selectedId: number | null
  selectedFinding: Finding | null
  timeline: Timeline | undefined
  timelineLoading: boolean
  timelineError: boolean
  onTimelineRetry: () => void
  heroFindings: HeroFinding[] | undefined
  showHeroHints: boolean
  onSearchChange: (value: string) => void
  onSeverityChange: (value: string) => void
  onToggleSort: (key: SortKey) => void
  onSelect: (finding: Finding) => void
  onHeroSelect: (hero: HeroFinding) => void
  compactTitle?: boolean
}

function sortIndicator(active: boolean, dir: 'asc' | 'desc') {
  if (!active) return ''
  return dir === 'asc' ? ' ↑' : ' ↓'
}

function dueDate(finding: Finding) {
  const value = finding.facts.contractual_due_date ?? finding.facts.forecast_date
  return value ? String(value) : 'k. A.'
}

export function Queue({
  analysisId,
  findings,
  totalCount,
  visibleCount,
  search,
  severity,
  sortKey,
  sortDir,
  selectedId,
  selectedFinding,
  timeline,
  timelineLoading,
  timelineError,
  onTimelineRetry,
  heroFindings,
  showHeroHints,
  onSearchChange,
  onSeverityChange,
  onToggleSort,
  onSelect,
  onHeroSelect,
  compactTitle = false,
}: QueueProps) {
  const title =
    totalCount != null
      ? `Ausnahmen (${visibleCount}/${totalCount})`
      : 'Ausnahmen'

  return (
    <section
      className="flex min-h-[360px] flex-col overflow-hidden border border-border bg-[var(--surface-raised)]"
      aria-label="Ausnahmen"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>

      {analysisId != null && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <ToggleGroup
            type="single"
            value={severity || 'all'}
            onValueChange={(v) => onSeverityChange(v === 'all' ? '' : v)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="all" aria-label="Alle">Alle</ToggleGroupItem>
            <ToggleGroupItem value="critical" aria-label="Kritisch">Kritisch</ToggleGroupItem>
            <ToggleGroupItem value="warning" aria-label="Warnung">Warnung</ToggleGroupItem>
          </ToggleGroup>
          <div className="relative min-w-[12rem] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={2}
            />
            <Input
              type="search"
              className="h-8 pl-8"
              placeholder="Standort, Regel oder Meldung…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto px-4 pb-4">
        {!analysisId && (
          <p className="py-6 text-sm text-muted-foreground">
            Analyse starten, um die Ausnahme-Warteschlange zu füllen.
          </p>
        )}
        {analysisId != null && !findings.length && !showHeroHints && (
          <p className="py-6 text-sm text-muted-foreground">
            {search.trim() ? `Keine Befunde für „${search}".` : 'Keine Befunde in diesem Lauf.'}
          </p>
        )}

        {showHeroHints && heroFindings && heroFindings.length > 0 && findings.length === 0 && (
          <ul className="space-y-2 py-4">
            {heroFindings.slice(0, 3).map((h, i) => (
              <li key={`${h.site_id}-${h.rule_id}-${i}`}>
                <button
                  type="button"
                  onClick={() => onHeroSelect(h)}
                  className="w-full rounded-md border border-border bg-muted/50 p-3 text-left text-sm hover:bg-accent/60"
                >
                  <Badge variant={severityBadgeVariant(h.severity)} className="mr-1">
                    {severityLabel(h.severity)}
                  </Badge>
                  <span className="font-mono text-xs">{h.site_id}</span>{' '}
                  <span className="font-mono text-xs">{h.rule_id}</span>
                  <p className="mt-1 text-muted-foreground">{h.message}</p>
                </button>
              </li>
            ))}
          </ul>
        )}

        {findings.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead
                  className="cursor-pointer"
                  onClick={() => onToggleSort('severity')}
                >
                  Schwere{sortIndicator(sortKey === 'severity', sortDir)}
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => onToggleSort('site_id')}
                >
                  Standort{sortIndicator(sortKey === 'site_id', sortDir)}
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => onToggleSort('rule_id')}
                >
                  Regel{sortIndicator(sortKey === 'rule_id', sortDir)}
                </TableHead>
                {!compactTitle && <TableHead>Fälligkeit</TableHead>}
                <TableHead>Meldung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.map((f) => {
                const selected = selectedId === f.id
                const critical = f.severity === 'critical'
                return (
                  <Fragment key={f.id}>
                    <TableRow
                      tabIndex={0}
                      data-state={selected ? 'selected' : undefined}
                      className={cn(
                        'h-11 cursor-pointer',
                        selected && 'bg-accent/50',
                        !selected && critical && 'bg-[var(--critical-bg)]/40',
                      )}
                      onClick={() => onSelect(f)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelect(f)
                        }
                      }}
                    >
                      <TableCell>
                        <Badge variant={severityBadgeVariant(f.severity)}>
                          {severityLabel(f.severity)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{f.site_id}</TableCell>
                      <TableCell className="font-mono text-xs">{f.rule_id}</TableCell>
                      {!compactTitle && (
                        <TableCell className="font-mono text-xs">{dueDate(f)}</TableCell>
                      )}
                      <TableCell>
                        <span className="line-clamp-2">{f.message}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{statusLabel(f.status)}</span>
                      </TableCell>
                    </TableRow>
                    {selected && selectedFinding && (
                      <TableRow key={`${f.id}-timeline`} className="hover:bg-transparent">
                        <TableCell colSpan={compactTitle ? 4 : 5} className="p-0">
                          <SelectedFindingTimeline
                            embedded
                            finding={selectedFinding}
                            timeline={timeline}
                            loading={timelineLoading}
                            error={timelineError}
                            onRetry={onTimelineRetry}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  )
}
