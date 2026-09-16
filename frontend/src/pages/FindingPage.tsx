import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Inspector } from '@/components/Inspector'
import { useWorkbench } from '@/context/workbench'
import { apiFetch } from '@/lib/api'
import type { Timeline } from '../types'

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
    queryFn: () =>
      apiFetch<Timeline>(
        `/api/sites/${selected!.site_id}/timeline?analysis_id=${wb.analysisId}`,
      ),
  })

  return (
    <Inspector
      selected={selected}
      loading={loading}
      timeline={timeline.data}
      timelineError={timeline.error ?? null}
      onTimelineRetry={() => void timeline.refetch()}
      explainPending={wb.explainPending}
      explainError={wb.explainError}
      reviewPending={wb.reviewPending}
      reviewClosed={reviewClosed}
      reviewError={wb.reviewError}
      reviewSuccess={wb.reviewSuccess}
      explainResult={wb.explainResult}
      highlightedEvidenceId={wb.highlightedEvidenceId}
      showBackLink
      onExplain={() => selected && wb.explainFinding(selected.id)}
      onExplainRetry={wb.retryExplain}
      onApprove={() => selected && wb.approveFinding(selected.id)}
      onDismiss={() => selected && wb.dismissFinding(selected.id)}
      onEvidenceHighlight={wb.highlightEvidence}
    />
  )
}
