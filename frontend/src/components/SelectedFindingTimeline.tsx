import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { timelineLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { Finding, Timeline } from '../types'

const MILESTONES: Array<{ key: string; label: string }> = [
  { key: 'permit_status', label: 'Genehmigung' },
  { key: 'construction_status', label: 'Bau' },
  { key: 'fibre_ready_date', label: 'Fibre-Ready' },
  { key: 'planned_integration', label: 'Geplante Integration' },
  { key: 'forecast_integration', label: 'Prognose Integration' },
  { key: 'integration_test_status', label: 'Integrationstest' },
  { key: 'acceptance_status', label: 'Abnahme' },
  { key: 'blocker_comment', label: 'Blocker' },
  { key: 'partner_status', label: 'Partnerstatus' },
]

type SelectedFindingTimelineProps = {
  finding: Finding
  timeline: Timeline | undefined
  loading: boolean
  error: boolean
  onRetry: () => void
  embedded?: boolean
}

export function SelectedFindingTimeline({
  finding,
  timeline,
  loading,
  error,
  onRetry,
  embedded = false,
}: SelectedFindingTimelineProps) {
  const [collapsed, setCollapsed] = useState(false)
  const data = timeline?.timeline ?? {}
  const hasMilestones = Object.values(data).some((v) => v)

  const Wrapper = embedded ? 'div' : 'section'
  const wrapperClass = embedded
    ? 'border-x border-b border-border bg-muted/20'
    : 'rounded-lg border border-border bg-[var(--surface-raised)]'

  return (
    <Wrapper className={wrapperClass} aria-label="Projektverlauf">
      <header className="flex min-h-11 flex-wrap items-center gap-3 border-b border-border px-4 py-2">
        <p className="text-sm font-medium">
          Projektverlauf · <span className="font-mono text-xs">{finding.site_id}</span>
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Link
            to={`/befund/${finding.id}`}
            className="inline-flex items-center gap-1 text-xs text-primary no-underline hover:underline"
          >
            Details öffnen
            <ExternalLink className="size-3" />
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Verlauf einblenden' : 'Verlauf ausblenden'}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </Button>
        </div>
      </header>
      {!collapsed && (
        <div className="p-4">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
          {error && (
            <p className="text-sm text-[var(--warn)]">
              Verlauf nicht geladen.{' '}
              <button type="button" className="underline" onClick={onRetry}>
                Erneut versuchen
              </button>
            </p>
          )}
          {!loading && !error && !hasMilestones && (
            <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(finding.facts).slice(0, 9).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-border py-2">
                  <dt className="text-muted-foreground">{timelineLabel(k)}</dt>
                  <dd className="font-mono text-xs">{v == null || v === '' ? 'k. A.' : String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
          {!loading && !error && hasMilestones && (
            <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {MILESTONES.map((m) => {
                const value = data[m.key] ?? null
                const violated =
                  finding.severity === 'critical' &&
                  (m.key === 'planned_integration' ||
                    m.key === 'forecast_integration' ||
                    m.key === 'integration_test_status')
                return (
                  <div key={m.key} className="bg-[var(--surface-raised)] px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">{m.label}</p>
                    <p
                      className={cn(
                        'mt-0.5 font-mono text-xs',
                        violated && 'font-semibold text-[var(--critical)]',
                      )}
                    >
                      {value ?? 'k. A.'}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
          {finding.severity === 'critical' && !loading && (
            <p className="mt-3 rounded-md bg-[var(--critical-bg)] px-3 py-2 text-sm text-[var(--critical)]">
              {finding.rule_id}: {finding.message}
            </p>
          )}
        </div>
      )}
    </Wrapper>
  )
}
