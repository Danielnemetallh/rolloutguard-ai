import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Inspector } from '@/components/Inspector'
import { PageHeader } from '@/components/PageHeader'
import { useWorkbench } from '@/context/WorkbenchContext'
import { API_BASE } from '@/lib/api'
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
    queryFn: async (): Promise<Timeline> => {
      const res = await fetch(
        `${API_BASE}/api/sites/${selected!.site_id}/timeline?analysis_id=${wb.analysisId}`,
      )
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  })

  return (
    <div className="space-y-5">
      <PageHeader title="Inspektor" description="Befund im Detail." />
      <Inspector
        selected={selected}
        loading={loading}
        timeline={timeline.data}
        reviewPending={wb.reviewPending}
        reviewClosed={reviewClosed}
        reviewError={wb.reviewError}
        reviewSuccess={wb.reviewSuccess}
        showBackLink
        onApprove={() => selected && wb.approveFinding(selected.id)}
        onDismiss={() => selected && wb.dismissFinding(selected.id)}
      />
    </div>
  )
}
