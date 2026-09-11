import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { statusLabel, timelineLabel } from '@/lib/labels'
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
    <Card className="flex min-h-[420px] flex-col overflow-hidden border-border bg-[var(--surface-raised)]" aria-label="Inspektor">
      <CardHeader className="border-b border-border py-3">
        {showBackLink && (
          <Link
            to="/"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            Zurück zur Warteschlange
          </Link>
        )}
        <CardTitle>Inspektor</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4 overflow-auto p-4">
        {loading && <p className="text-sm text-muted-foreground">Lade Befund…</p>}
        {!loading && !selected && (
          <p className="text-sm text-muted-foreground">
            Befund nicht gefunden. Starte eine Analyse und wähle einen Eintrag in der Warteschlange.
          </p>
        )}
        {selected && (
          <>
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground">
                {selected.rule_id} · {selected.site_id}
              </p>
              <Badge variant="outline">{statusLabel(selected.status)}</Badge>
              <p className="text-sm leading-relaxed">{selected.message}</p>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant={armedAction === 'approve' ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleApprove}
                  disabled={reviewPending || reviewClosed}
                >
                  {reviewPending
                    ? 'Speichere…'
                    : armedAction === 'approve'
                      ? 'Bestätigen'
                      : 'Freigeben'}
                </Button>
                <Button
                  type="button"
                  variant={armedAction === 'dismiss' ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleDismiss}
                  disabled={reviewPending || reviewClosed}
                >
                  {armedAction === 'dismiss' ? 'Verwerfen bestätigen' : 'Verwerfen'}
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
            </div>

            {Object.keys(selected.facts).length > 0 && (
              <section className="border-t border-border pt-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fakten</h3>
                <dl className="mt-2 divide-y divide-border text-sm">
                  {Object.entries(selected.facts).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-2 gap-2 py-2">
                      <dt className="text-muted-foreground">{timelineLabel(k)}</dt>
                      <dd className="font-mono text-xs">{formatFact(k, v)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {timeline && (
              <section className="border-t border-border pt-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Standort-Timeline
                </h3>
                <dl className="mt-2 divide-y divide-border text-sm">
                  {Object.entries(timeline.timeline).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-2 gap-2 py-2">
                      <dt className="text-muted-foreground">{timelineLabel(k)}</dt>
                      <dd className="font-mono text-xs">{formatTimelineValue(v)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
