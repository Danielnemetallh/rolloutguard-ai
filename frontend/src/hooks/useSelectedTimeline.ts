import { useQuery } from '@tanstack/react-query'
import { API_BASE } from '@/lib/api'
import type { Finding, Timeline } from '../types'

export function useSelectedTimeline(selected: Finding | null, analysisId: number | null) {
  return useQuery({
    queryKey: ['timeline', selected?.site_id, analysisId],
    enabled: !!selected?.site_id && analysisId != null,
    queryFn: async (): Promise<Timeline> => {
      const res = await fetch(
        `${API_BASE}/api/sites/${selected!.site_id}/timeline?analysis_id=${analysisId}`,
      )
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  })
}
