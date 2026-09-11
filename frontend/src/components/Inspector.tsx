import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ruleLabel, severityBadgeVariant, severityLabel, statusLabel, timelineLabel } from '@/lib/labels'
import type { Finding, Timeline } from '../types'

type InspectorProps = {
  selected: Finding | null
  loading?: boolean
  timeline: Timeline | undefined
  reviewPending: boolean
  reviewClosed: boolean
  reviewError: boolean
  reviewSuccess: boolean
  showBackLink?: boolean
  onApprove: () => void
  onDismiss: () => void
}

function formatTimelineValue(value: string | null) {
  return value ?? 'k. A.'
}

function formatFact(key: string, value: unknown) {
  if (value == null || value === '') return 'k. A.'
  if (Array.isArray(value)) {
    const mapped = value.map((item) =>
      typeof item === 'string' && (key === 'missing_sources' || key === 'present')
        ? timelineLabel(item)
        : String(item),
    )
    return mapped.join(', ')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function Inspector({
  selected,
  loading = false,
  timeline,
  reviewPending,
  reviewClosed,
  reviewError,
  reviewSuccess,
  showBackLink = false,
  onApprove,
  onDismiss,
}: InspectorProps) {
  const [armedAction, setArmedAction] = useState<'approve' | 'dismiss' | null>(null)

  useEffect(() => {
    setArmedAction(null)
  }, [selected?.id])

  const handleApprove = () => {
    if (armedAction !== 'approve') {
      setArmedAction('approve')
      return
    }
    setArmedAction(null)
    onApprove()
  }

  const handleDismiss = () => {
    if (armedAction !== 'dismiss') {
      setArmedAction('dismiss')
      return
    }
    setArmedAction(null)
    onDismiss()
  }

  return (
    <section className="min-h-[420px] overflow-hidden border border-border bg-[var(--surface-raised)]" aria-label="Inspektor">
      <header className="border-b border-border px-5 py-4">
        {showBackLink && (
          <Link
            to="/"
            className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Zurück zur Warteschlange
          </Link>
        )}
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Befundprüfung</p>
        <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em]">Inspektor</h1>
      </header>
      <div className="space-y-0">
        {loading && (
          <p className="px-5 py-8 text-sm text-muted-foreground">Lade Befund…</p>
        )}
        {!loading && !selected && (
          <p className="px-5 py-8 text-sm text-muted-foreground">
            Befund nicht gefunden. Starte eine Analyse und wähle einen Eintrag in der
            Warteschlange.
          </p>
        )}
        {selected && (
          <>
            <section className="px-5 py-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Badge variant={severityBadgeVariant(selected.severity)}>
                  {severityLabel(selected.severity)}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">{selected.rule_id}</span>
                <span className="font-mono text-xs text-muted-foreground">{selected.site_id}</span>
                <Badge variant="outline" className="ml-auto">{statusLabel(selected.status)}</Badge>
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-[-0.015em]">{ruleLabel(selected.rule_id)}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{selected.message}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApprove}
                  disabled={reviewPending || reviewClosed}
                >
                  {reviewPending
                    ? 'Speichere…'
                    : armedAction === 'approve'
                      ? 'Bestätigung speichern'
                      : 'Befund bestätigen'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDismiss}
                  disabled={reviewPending || reviewClosed}
                >
                  {armedAction === 'dismiss' ? 'Fehlalarm speichern' : 'Als Fehlalarm markieren'}
                </Button>
              </div>

              {reviewError && (
                <p className="text-sm text-[var(--warn)]">
                  Prüfung konnte nicht gespeichert werden. Läuft die API?
                </p>
              )}
              {reviewSuccess && reviewClosed && (
                <p className="text-sm text-muted-foreground">
                  Prüfung gespeichert ({statusLabel(selected.status)}).
                </p>
              )}

            </section>

            {Object.keys(selected.facts).length > 0 && (
              <section className="border-t border-border px-5 py-5">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Fakten</h2>
                  <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
                    {Object.entries(selected.facts).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-2 gap-4 py-2.5">
                        <dt className="text-muted-foreground">{timelineLabel(k)}</dt>
                        <dd className="text-right font-mono text-xs">{formatFact(k, v)}</dd>
                      </div>
                    ))}
                  </dl>
              </section>
            )}

            {timeline && (
              <section className="border-t border-border px-5 py-5">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Standort-Timeline</h2>
                  <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
                    {Object.entries(timeline.timeline).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-2 gap-4 py-2.5">
                        <dt className="text-muted-foreground">{timelineLabel(k)}</dt>
                        <dd className="text-right font-mono text-xs">{formatTimelineValue(v)}</dd>
                      </div>
                    ))}
                  </dl>
              </section>
            )}
          </>
        )}
      </div>
    </section>
  )
}
