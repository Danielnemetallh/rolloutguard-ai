import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ruleLabel, severityBadgeVariant, severityLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Finding, HeroFinding, SortKey } from '../types'

type QueueProps = {
  analysisId: number | null
  findings: Finding[]
  totalCount: number | undefined
  visibleCount: number
  loading?: boolean
  error?: boolean
  selectedId?: number | null
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
  onRetry?: () => void
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
  loading = false,
  error = false,
  selectedId = null,
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
  onRetry,
}: QueueProps) {
  return (
    <section
      className="flex min-h-[440px] flex-col overflow-hidden bg-[var(--surface-raised)]"
      aria-label="Befunde"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Ausnahmen</h2>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {totalCount != null ? `${visibleCount} von ${totalCount} Befunden` : 'Warteschlange'}
          </p>
        </div>
      </div>

      {analysisId != null && (
        <div className="space-y-2.5 border-b border-border px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex rounded-md bg-[var(--surface-inset)] p-0.5">
            {SEVERITY_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => onSeverityChange(f.value)}
                className={cn(
                  'rounded-[4px] px-2.5 py-1 text-xs font-medium transition-colors',
                  severity === f.value
                    ? 'bg-[var(--surface-raised)] text-foreground shadow-[0_1px_2px_oklch(24%_0.02_250_/_10%)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[10rem] flex-1">
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
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground" aria-label="Sortierung">
            <span className="mr-1">Sortieren:</span>
            {([
              ['severity', 'Priorität'],
              ['site_id', 'Standort'],
              ['rule_id', 'Regel'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onToggleSort(key)}
                className={cn(
                  'rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground',
                  sortKey === key && 'font-medium text-foreground',
                )}
              >
                {label}{sortIndicator(sortKey === key, sortDir)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="space-y-2 p-4" aria-label="Ausnahmen werden geladen">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between gap-3 p-4 py-6 text-sm text-[var(--critical)]">
            <span>Ausnahmen konnten nicht geladen werden.</span>
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={onRetry}
            >
              Wiederholen
            </button>
          </div>
        )}
        {!analysisId && (
          <p className="p-4 py-6 text-sm text-muted-foreground">
            Analyse starten, um die Ausnahme-Warteschlange zu füllen.
          </p>
        )}
        {!loading && !error && analysisId != null && !findings.length && !showHeroHints && (
          <p className="p-4 py-6 text-sm text-muted-foreground">
            {search.trim()
              ? `Keine Befunde für „${search}".`
              : 'Keine Befunde in diesem Lauf.'}
          </p>
        )}

        {showHeroHints && heroFindings && heroFindings.length > 0 && (
          <div className="p-4">
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

        {!loading && !error && findings.length > 0 && (
          <div>
            <table className="queue-table-condensed w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">
                    <button type="button" onClick={() => onToggleSort('severity')}>
                      Schwere{sortIndicator(sortKey === 'severity', sortDir)}
                    </button>
                  </th>
                  <th className="px-3 py-2">
                    <button type="button" onClick={() => onToggleSort('site_id')}>
                      Standort{sortIndicator(sortKey === 'site_id', sortDir)}
                    </button>
                  </th>
                  <th className="px-3 py-2">
                    <button type="button" onClick={() => onToggleSort('rule_id')}>
                      Regel{sortIndicator(sortKey === 'rule_id', sortDir)}
                    </button>
                  </th>
                  <th className="px-3 py-2">Meldung</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => (
                  <tr
                    key={f.id}
                    tabIndex={0}
                    aria-selected={selectedId === f.id}
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/35',
                      selectedId === f.id &&
                        'bg-[var(--selection)] shadow-[inset_3px_0_0_var(--primary)]',
                    )}
                    onClick={() => onSelect(f)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelect(f)
                      }
                    }}
                  >
                    <td>
                      <Badge variant={severityBadgeVariant(f.severity)}>
                        {severityLabel(f.severity)}
                      </Badge>
                    </td>
                    <td className="font-mono text-[11px] text-muted-foreground">{f.site_id}</td>
                    <td className="font-mono text-[11px] text-muted-foreground">{f.rule_id}</td>
                    <td>
                      <p className="font-medium text-foreground">{ruleLabel(f.rule_id)}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{f.message}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
