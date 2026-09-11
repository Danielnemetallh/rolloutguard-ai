import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ExternalLink, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { API_BASE } from '@/lib/api'
import { ruleLabel, timelineLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Finding, Timeline } from '@/types'

type SelectedFindingTimelineProps = {
  finding: Finding | null
  analysisId: number | null
}

function displayValue(value: string | null) {
  return value || 'k. A.'
}

export function SelectedFindingTimeline({
  finding,
  analysisId,
}: SelectedFindingTimelineProps) {
  const [collapsed, setCollapsed] = useState(false)
  const timeline = useQuery({
    queryKey: ['timeline', finding?.site_id, analysisId],
    enabled: finding != null && analysisId != null,
    queryFn: async (): Promise<Timeline> => {
      const response = await fetch(
        `${API_BASE}/api/sites/${finding!.site_id}/timeline?analysis_id=${analysisId}`,
      )
      if (!response.ok) throw new Error(await response.text())
      return response.json()
    },
  })

  useEffect(() => setCollapsed(false), [finding?.id])
  if (finding == null) return null

  const milestones = Object.entries(timeline.data?.timeline ?? {}).filter(([, value]) => value)
  const isCritical = finding.severity === 'critical'

  return (
    <section className="bg-[var(--surface-subtle)]" aria-label="Ausgewählter Projektverlauf">
      <header className="flex min-h-12 flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">Projektverlauf · {finding.site_id}</h2>
          <p className="font-mono text-[10px] text-muted-foreground">{finding.rule_id}</p>
        </div>
        <Link
          to={`/befund/${finding.id}`}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Details öffnen <ExternalLink className="size-3" />
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Projektverlauf ausklappen' : 'Projektverlauf einklappen'}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <ChevronDown className={cn('size-4 transition-transform duration-150', collapsed && '-rotate-90')} />
        </button>
      </header>

      {!collapsed && (
        <div className="p-5">
          {timeline.isPending && (
            <div className="space-y-3" aria-label="Projektverlauf wird geladen">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-14 animate-pulse rounded bg-muted" />
            </div>
          )}
          {timeline.isError && (
            <div className="flex items-center justify-between gap-3 rounded-md bg-[var(--critical-bg)] px-3 py-2 text-sm text-[var(--critical)]">
              <span>Projektverlauf konnte nicht geladen werden.</span>
              <Button size="sm" variant="outline" onClick={() => void timeline.refetch()}>
                <RotateCcw className="size-3.5" /> Wiederholen
              </Button>
            </div>
          )}
          {timeline.data && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={finding.severity === 'critical' ? 'critical' : 'warning'}>
                    {finding.severity === 'critical' ? 'Kritisch' : 'Warnung'}
                  </Badge>
                  <h3 className="text-sm font-semibold">{ruleLabel(finding.rule_id)}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{finding.message}</p>
              </div>
              {milestones.length > 0 ? (
                <ol className="border-t border-border">
                  {milestones.map(([key, value]) => {
                    const signalsViolation = isCritical && (
                      (finding.rule_id === 'SLA-001' && /contractual_due|forecast|actual/.test(key)) ||
                      (finding.rule_id === 'SEQ-001' && /permit|construction/.test(key)) ||
                      (finding.rule_id === 'SEQ-002' && /fibre_ready|integration/.test(key)) ||
                      (finding.rule_id === 'SEQ-003' && /integration_test|acceptance/.test(key)) ||
                      (finding.rule_id === 'DQ-001' && /forecast/.test(key))
                    )
                    return (
                      <li key={key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border py-2.5">
                        <p className="truncate text-xs text-muted-foreground">{timelineLabel(key)}</p>
                        <p className={cn('font-mono text-xs font-medium', signalsViolation && 'text-[var(--critical)]')}>
                          {displayValue(value)}
                        </p>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {Object.entries(finding.facts).slice(0, 6).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4 border-b border-border py-2">
                      <dt className="text-muted-foreground">{timelineLabel(key)}</dt>
                      <dd className="font-mono text-xs">{String(value ?? 'k. A.')}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Nachweise</p>
                  {timeline.data.evidence.length > 0 ? (
                    <ul className="mt-2 divide-y divide-border border-y border-border font-mono text-[11px] text-muted-foreground">
                      {timeline.data.evidence.slice(0, 6).map((evidence) => (
                        <li key={evidence.evidence_id} className="py-2">
                          {evidence.file}, {evidence.sheet} r{evidence.row}, {evidence.column}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Keine Quellkoordinaten verfügbar.</p>
                  )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
