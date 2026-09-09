import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { severityBadgeVariant, severityLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Finding, HeroFinding, SortKey } from '../types'

type QueueProps = {
  analysisId: number | null
  findings: Finding[]
  totalCount: number | undefined
  visibleCount: number
  search: string
  severity: string
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  heroFindings: HeroFinding[] | undefined
  showHeroHints: boolean
  onSearchChange: (value: string) => void
  onSeverityChange: (value: string) => void
  onToggleSort: (key: SortKey) => void
  onSelect: (finding: Finding) => void
  onHeroSelect: (hero: HeroFinding) => void
}

const SEVERITY_FILTERS = [
  { value: '', label: 'Alle' },
  { value: 'critical', label: 'Kritisch' },
  { value: 'warning', label: 'Warnung' },
] as const

function sortIndicator(active: boolean, dir: 'asc' | 'desc') {
  if (!active) return ''
  return dir === 'asc' ? ' ↑' : ' ↓'
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
  heroFindings,
  showHeroHints,
  onSearchChange,
  onSeverityChange,
  onToggleSort,
  onSelect,
  onHeroSelect,
}: QueueProps) {
  return (
    <Card className="flex min-h-[420px] flex-col overflow-hidden" aria-label="Befunde">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="font-heading text-sm font-semibold">
          Befunde
          {totalCount != null && ` (${visibleCount}/${totalCount})`}
        </h2>
      </div>

      {analysisId != null && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <div className="flex rounded-md border border-border p-0.5">
            {SEVERITY_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => onSeverityChange(f.value)}
                className={cn(
                  'rounded-[5px] px-3 py-1.5 text-sm transition-colors active:scale-[0.98]',
                  severity === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[12rem] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={2}
            />
            <Input
              type="search"
              className="pl-8"
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
            {search.trim()
              ? `Keine Befunde für „${search}".`
              : 'Keine Befunde in diesem Lauf.'}
          </p>
        )}

        {showHeroHints && heroFindings && heroFindings.length > 0 && (
          <div className="mb-4 pt-3">
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Top-Befunde dieses Laufs
            </p>
            <ul className="space-y-2">
              {heroFindings.slice(0, 3).map((h, i) => (
                <li key={`${h.site_id}-${h.rule_id}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onHeroSelect(h)}
                    className="w-full rounded-md border border-border bg-muted/50 p-3 text-left text-sm transition-colors hover:bg-accent/60"
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
          </div>
        )}

        {findings.length > 0 && (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="cursor-pointer px-3 py-2" onClick={() => onToggleSort('severity')}>
                    Schwere{sortIndicator(sortKey === 'severity', sortDir)}
                  </th>
                  <th className="cursor-pointer px-3 py-2" onClick={() => onToggleSort('site_id')}>
                    Standort{sortIndicator(sortKey === 'site_id', sortDir)}
                  </th>
                  <th className="cursor-pointer px-3 py-2" onClick={() => onToggleSort('rule_id')}>
                    Regel{sortIndicator(sortKey === 'rule_id', sortDir)}
                  </th>
                  <th className="px-3 py-2">Meldung</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => (
                  <tr
                    key={f.id}
                    className="cursor-pointer border-b border-border transition-colors hover:bg-muted/50"
                    onClick={() => onSelect(f)}
                  >
                    <td className="px-3 py-2">
                      <Badge variant={severityBadgeVariant(f.severity)}>
                        {severityLabel(f.severity)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{f.site_id}</td>
                    <td className="px-3 py-2 font-mono text-xs">{f.rule_id}</td>
                    <td className="px-3 py-2">{f.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  )
}
