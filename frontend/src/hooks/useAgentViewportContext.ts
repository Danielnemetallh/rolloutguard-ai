import { useMemo } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useWorkbench } from '@/context/workbench'
import type { Finding } from '@/types'

const PAGE_LABELS: Record<string, string> = {
  '/': 'Leitstand',
  '/ausnahmen': 'Ausnahmen',
  '/dokumente': 'Dokumente',
  '/laeufe': 'Läufe',
}

export type AgentViewportFinding = {
  id: number
  site_id: string
  rule_id: string
  severity: string
  status: string
  message: string
  facts: Record<string, unknown>
  evidence_count: number
}

export type AgentViewportContext = {
  label: string
  page: string
  findingId: number | null
  selectedFinding: AgentViewportFinding | null
  pendingDraftCount: number
}

function asFindingId(value: string | null | undefined): number | null {
  if (!value) return null
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

/** Shell sits outside <Routes>, so /befund/:id must be read from the path. */
export function findingIdFromLocation(
  pathname: string,
  searchBefund: string | null,
): number | null {
  const pathMatch = pathname.match(/^\/befund\/(\d+)\/?$/)
  return asFindingId(pathMatch?.[1]) ?? asFindingId(searchBefund)
}

export function pageLabelFromPathname(pathname: string): { page: string; label: string } {
  if (pathname.startsWith('/befund/')) {
    return { page: 'befund', label: 'Inspektor' }
  }
  const page = pathname.replace(/^\//, '') || 'leitstand'
  return { page, label: PAGE_LABELS[pathname] ?? 'Workbench' }
}

export function snapshotFinding(finding: Finding): AgentViewportFinding {
  return {
    id: finding.id,
    site_id: finding.site_id,
    rule_id: finding.rule_id,
    severity: finding.severity,
    status: finding.status,
    message: finding.message,
    facts: finding.facts ?? {},
    evidence_count: finding.evidence?.length ?? 0,
  }
}

export function useAgentViewportContext(): AgentViewportContext {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const workbench = useWorkbench()
  const befundParam = searchParams.get('befund')

  return useMemo(() => {
    const findingId = findingIdFromLocation(pathname, befundParam)
    const finding =
      findingId == null
        ? null
        : workbench.findings.find((candidate) => candidate.id === findingId) ?? null
    const { page, label: pageLabel } = pageLabelFromPathname(pathname)

    let label = pageLabel
    if (finding) {
      label = `${finding.rule_id} · ${finding.site_id}`
    } else if (page === 'befund' && findingId != null) {
      label = `Befund #${findingId}`
    }

    return {
      label,
      page,
      findingId,
      selectedFinding: finding ? snapshotFinding(finding) : null,
      pendingDraftCount: workbench.pendingActionCount,
    }
  }, [befundParam, pathname, workbench.findings, workbench.pendingActionCount])
}
