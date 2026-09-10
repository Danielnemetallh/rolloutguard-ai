export const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Kritisch',
  warning: 'Warnung',
}

export const STATUS_LABELS: Record<string, string> = {
  open: 'Offen',
  approved: 'Bestätigt',
  dismissed: 'Verworfen',
}

export const TIMELINE_LABELS: Record<string, string> = {
  contractual_due_date: 'Vertragsfälligkeit',
  planned_date: 'Geplant',
  forecast_date: 'Forecast',
  actual_date: 'Ist',
  fibre_ready_date: 'Fibre-Ready',
  permit_status: 'Genehmigung',
  construction_status: 'Bau',
  integration_test_status: 'Integrationstest',
  acceptance_status: 'Abnahme',
  partner_status: 'Partnerstatus',
  last_updated_at: 'Zuletzt aktualisiert',
  missing_sources: 'Fehlende Quellen',
  present: 'Vorhanden',
  delta_days: 'Tage Abweichung',
  age_days: 'Alter in Tagen',
  threshold_days: 'Schwelle in Tagen',
  raw_status: 'Rohstatus',
  bad_cells: 'Ungültige Zellen',
  forecasts: 'Forecasts',
  contract: 'Vertrag',
  schedule: 'Terminplan',
  required_evidence: 'Erforderliche Evidenz',
  blocker_comment: 'Blocker-Kommentar',
}

export function severityLabel(severity: string) {
  return SEVERITY_LABELS[severity] ?? severity
}

export function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}

export function timelineLabel(key: string) {
  return TIMELINE_LABELS[key] ?? key
}

export function severityBadgeVariant(severity: string) {
  if (severity === 'critical') return 'critical' as const
  if (severity === 'warning') return 'warning' as const
  return 'muted' as const
}
