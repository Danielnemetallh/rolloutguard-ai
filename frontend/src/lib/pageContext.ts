import { matchPath } from 'react-router-dom'

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Leitstand',
  '/ausnahmen': 'Ausnahmen',
  '/dokumente': 'Dokumente',
  '/aktionen': 'Aktionen',
  '/laeufe': 'Läufe',
}

export function pageContextLabel(pathname: string, befundId?: string | null, siteId?: string | null) {
  const finding = matchPath('/befund/:id', pathname)
  if (finding) {
    const id = siteId ?? finding.params.id
    return `Inspektor · ${id}`
  }
  const base = ROUTE_LABELS[pathname] ?? 'Workbench'
  if (befundId && (pathname === '/' || pathname === '/ausnahmen')) {
    return `${base} · Befund ${befundId}`
  }
  return base
}

export function buildAgentQuestion(question: string, contextLabel: string) {
  const prefix = `[Kontext: ${contextLabel}]`
  if (question.startsWith('[Kontext:')) return question
  return `${prefix}\n${question}`
}
