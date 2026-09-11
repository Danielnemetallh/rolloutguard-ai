import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { EvidenceChips } from '@/components/EvidenceChips'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ruleLabel, severityBadgeVariant, severityLabel, statusLabel, timelineLabel } from '@/lib/labels'
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
                  size="sm"
                  onClick={onExplain}
                  disabled={explainPending}
                >
                  {explainPending ? 'Erkläre…' : 'KI erklären'}
                </Button>
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

              {onDraftAction && (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Aktion vorbereiten
                  </p>
                  <div className="flex flex-wrap gap-2">
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
                  <p className="mt-2 text-[11px] text-muted-foreground">Entwürfe werden erst in der Aktionsqueue freigegeben.</p>
                </div>
              )}

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

              {explainResult && (
                <div className="mt-5 border-l-2 border-primary bg-[var(--surface-subtle)] px-4 py-3">
                  <div className="space-y-2">
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
                  </div>
                </div>
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

            <section className="border-t border-border px-5 py-5">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Quellzellen</h2>
                <ul className="mt-3 divide-y divide-border border-y border-border text-sm">
                  {selected.evidence.map((e) => (
                    <li
                      key={e.evidence_id}
                      id={`evidence-${e.evidence_id}`}
                      className={cn(
                        'border border-transparent px-2 py-2.5 font-mono text-xs transition-colors',
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
            </section>

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
