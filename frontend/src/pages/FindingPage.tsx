import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Inspector } from '@/components/Inspector'
import { useWorkbench } from '@/context/workbench'
import type { Timeline } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export function FindingPage() {
  const { id } = useParams<{ id: string }>()
  const findingId = Number(id)
  const wb = useWorkbench()

  const selected = wb.findings.find((f) => f.id === findingId) ?? null
  const reviewClosed =
    selected?.status === 'approved' || selected?.status === 'dismissed'
  const loading = wb.findingsLoading && !selected

  const timeline = useQuery({
    queryKey: ['timeline', selected?.site_id, wb.analysisId],
    enabled: !!selected?.site_id && wb.analysisId != null,
    queryFn: async (): Promise<Timeline> => {
      const res = await fetch(
        `${API_BASE}/api/sites/${selected!.site_id}/timeline?analysis_id=${wb.analysisId}`,
      )
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  })

  return (
    <Inspector
      selected={selected}
      loading={loading}
      timeline={timeline.data}
      explainPending={wb.explainPending}
      reviewPending={wb.reviewPending}
      reviewClosed={reviewClosed}
      reviewError={wb.reviewError}
      reviewSuccess={wb.reviewSuccess}
      explainResult={wb.explainResult}
      highlightedEvidenceId={wb.highlightedEvidenceId}
      showBackLink
      onExplain={() => selected && wb.explainFinding(selected.id)}
      onApprove={() => selected && wb.approveFinding(selected.id)}
      onDismiss={() => selected && wb.dismissFinding(selected.id)}
      onEvidenceHighlight={wb.highlightEvidence}
      onDraftAction={(kind) => {
        if (!selected) return
        const due = String(selected.facts.contractual_due_date ?? '2026-09-15')
        const payloads: Record<typeof kind, Record<string, unknown>> = {
          calendar: {
            site_id: selected.site_id,
            title: `SLA-Risiko ${selected.site_id}`,
            date: due,
            milestone_kind: 'due',
            description: selected.message,
          },
          email: {
            to: 'partner@nordturm.demo',
            subject: `${selected.rule_id} ${selected.site_id}`,
            body: selected.message,
            site_id: selected.site_id,
          },
          board: {
            title: `${selected.rule_id} ${selected.site_id}`,
            body: selected.message,
            site_id: selected.site_id,
          },
          override: {
            site_id: selected.site_id,
            field: 'forecast_date',
            new_value: due,
            reason: 'Analyst Override aus Inspektor',
          },
          watch: {
            site_id: selected.site_id,
            rule_id: selected.rule_id,
          },
        }
        wb.onDraftAction({
          action_type: kind,
          payload: payloads[kind],
          site_id: selected.site_id,
        })
      }}
    />
  )
}
