import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { EvidenceChips } from '@/components/EvidenceChips'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { statusLabel, timelineLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import type { ExplainResult, Finding, Timeline } from '../types'

type DraftKind = 'calendar' | 'email' | 'board' | 'override' | 'watch'

type InspectorProps = {
  selected: Finding | null
  loading?: boolean
  timeline: Timeline | undefined
  explainPending: boolean
  reviewPending: boolean
  reviewClosed: boolean
  reviewError: boolean
  reviewSuccess: boolean
  explainResult: ExplainResult | undefined
  highlightedEvidenceId: string | null
  showBackLink?: boolean
  onExplain: () => void
  onApprove: () => void
  onDismiss: () => void
  onEvidenceHighlight: (id: string) => void
  onDraftAction?: (kind: DraftKind) => void
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
  explainPending,
  reviewPending,
  reviewClosed,
  reviewError,
  reviewSuccess,
  explainResult,
  highlightedEvidenceId,
  showBackLink = false,
  onExplain,
  onApprove,
  onDismiss,
  onEvidenceHighlight,
  onDraftAction,
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
    <Card className="flex min-h-[420px] flex-col overflow-hidden" aria-label="Inspektor">
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
        {loading && (
          <p className="text-sm text-muted-foreground">Lade Befund…</p>
        )}
        {!loading && !selected && (
          <p className="text-sm text-muted-foreground">
            Befund nicht gefunden. Starte eine Analyse und wähle einen Eintrag in der
            Warteschlange.
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
                  variant="outline"
                  size="sm"
                  onClick={onExplain}
                  disabled={explainPending}
                >
                  {explainPending ? 'Erkläre…' : 'KI erklären'}
                </Button>
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

              {onDraftAction && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => onDraftAction('calendar')}>
                    Kalender
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onDraftAction('email')}>
                    Mail
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onDraftAction('board')}>
                    Karte
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onDraftAction('override')}>
                    Override
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onDraftAction('watch')}>
                    Watch
                  </Button>
                </div>
              )}

              {reviewError && (
                <p className="text-sm text-[var(--warn)]">
                  Prüfung konnte nicht gespeichert werden — läuft die API?
                </p>
              )}
              {reviewSuccess && reviewClosed && (
                <p className="text-sm text-muted-foreground">
                  Prüfung gespeichert ({statusLabel(selected.status)}).
                </p>
              )}

              {explainResult && (
                <Card className="bg-muted/40">
                  <CardContent className="space-y-2 pt-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      KI-Erklärung
                    </p>
                    <p className="text-sm">{explainResult.explanation.summary}</p>
                    {explainResult.explanation.proposed_next_action && (
                      <p className="text-sm">
                        <strong>Nächster Schritt:</strong>{' '}
                        {explainResult.explanation.proposed_next_action}
                      </p>
                    )}
                    <EvidenceChips
                      ids={explainResult.explanation.evidence_ids}
                      onSelect={onEvidenceHighlight}
                    />
                    <p className="text-xs text-muted-foreground">
                      Kategorie={explainResult.explanation.blocker_category ?? 'k. A.'} ·
                      Konfidenz={explainResult.explanation.confidence} ·
                      Enthaltung={String(explainResult.explanation.abstained)}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {Object.keys(selected.facts).length > 0 && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                    Fakten
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y divide-border text-sm">
                    {Object.entries(selected.facts).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-2 gap-2 py-2">
                        <dt className="text-muted-foreground">{timelineLabel(k)}</dt>
                        <dd className="font-mono text-xs">{formatFact(k, v)}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  Quellzellen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {selected.evidence.map((e) => (
                    <li
                      key={e.evidence_id}
                      id={`evidence-${e.evidence_id}`}
                      className={cn(
                        'rounded-md border border-transparent px-2 py-1 font-mono text-xs transition-colors',
                        highlightedEvidenceId === e.evidence_id &&
                          'border-primary bg-accent/80',
                      )}
                    >
                      <code className="text-primary">{e.evidence_id}</code>{' '}
                      {e.file} / {e.sheet} r{e.row} · {e.column}
                      {e.value != null && (
                        <span className="text-muted-foreground"> = {e.value}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {timeline && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                    Standort-Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y divide-border text-sm">
                    {Object.entries(timeline.timeline).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-2 gap-2 py-2">
                        <dt className="text-muted-foreground">{timelineLabel(k)}</dt>
                        <dd className="font-mono text-xs">{formatTimelineValue(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
