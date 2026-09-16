import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { Finding, HeroFinding, SortKey } from '../types'

export function useFindingsQueue(
  analysisId: number | null,
  heroFindings: HeroFinding[] | undefined,
  statusOverrides: Record<number, string>,
) {
  const [severity, setSeverity] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('severity')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const findings = useQuery({
    queryKey: ['findings', analysisId],
    enabled: analysisId != null,
    queryFn: () =>
      apiFetch<{ count: number; findings: Finding[] }>(
        `/api/analyses/${analysisId!}/findings`,
      ),
  })

  const findingsLoading =
    analysisId != null && (findings.isPending || findings.isFetching)

  const mappedFindings = (findings.data?.findings ?? []).map((f) =>
    statusOverrides[f.id] ? { ...f, status: statusOverrides[f.id] } : f,
  )

  const visibleFindings = mappedFindings
    .filter((f) => (severity ? f.severity === severity : true))
    .filter((f) => {
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      return (
        f.site_id.toLowerCase().includes(q) ||
        f.rule_id.toLowerCase().includes(q) ||
        f.message.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      return a[sortKey] < b[sortKey] ? -1 * dir : a[sortKey] > b[sortKey] ? 1 * dir : 0
    })

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  const showHeroHints = analysisId != null && !search.trim() && !!heroFindings?.length

  const matchHeroFinding = useCallback(
    (hero: HeroFinding) =>
      mappedFindings.find(
        (f) =>
          f.rule_id === hero.rule_id &&
          f.site_id === hero.site_id &&
          f.message === hero.message,
      ) ?? mappedFindings.find((f) => f.rule_id === hero.rule_id && f.site_id === hero.site_id),
    [mappedFindings],
  )
  return {
    findings: mappedFindings,
    totalCount: findings.data?.count,
    visibleFindings,
    findingsLoading,
    search,
    severity,
    sortKey,
    sortDir,
    showHeroHints,
    findingsError: findings.error ?? null,
    retryFindings: () => {
      void findings.refetch()
    },
    matchHeroFinding,
    onSearchChange: setSearch,
    onSeverityChange: setSeverity,
    onToggleSort: toggleSort,
  }
}
