export const ACTION_TYPE_LABELS: Record<string, string> = {
  calendar: 'Kalender',
  email: 'E-Mail',
  briefing: 'Briefing',
  digest: 'Digest',
  board: 'Karte',
  task: 'Aufgabe',
  override: 'Override',
  watch: 'Watch',
  watch_fire: 'Watch-Erinnerung',
}

export const ACTION_STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  confirmed: 'Freigegeben',
  dismissed: 'Verworfen',
  failed: 'Fehlgeschlagen',
}

export function actionSummary(payload: Record<string, unknown>) {
  return String(payload.title ?? payload.subject ?? payload.message ?? payload.body ?? '')
}
