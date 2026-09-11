export const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Kritisch',
  warning: 'Warnung',
}

export const STATUS_LABELS: Record<string, string> = {
  open: 'Offen',
  approved: 'Bestätigt',
  dismissed: 'Verworfen',
}

export const ACTION_STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  confirmed: 'Freigegeben',
  executed: 'Ausgeführt',
  dismissed: 'Verworfen',
  failed: 'Fehlgeschlagen',
}

export const ANALYSIS_STATUS_LABELS: Record<string, string> = {
  pending: 'Ausstehend',
  running: 'Läuft',
  completed: 'Abgeschlossen',
  failed: 'Fehlgeschlagen',
}

export const RULE_LABELS: Record<string, string> = {
  'DQ-001': 'Widersprüchliche Forecast-Daten',
  'DQ-002': 'Pflichtquelle fehlt',
  'DQ-003': 'Datum nicht lesbar',
  'DQ-004': 'Status nicht zuordenbar',
  'SEQ-001': 'Bau ohne Genehmigung',
  'SEQ-002': 'Integration vor Fibre-Ready',
  'SEQ-003': 'Abnahme vor Integrationstest',
  'STS-001': 'Fertigstatus ohne Ist-Datum',
  'STS-002': 'Ist-Datum widerspricht Status',
  'SLA-001': 'Vertragsziel überschritten',
  'FRS-001': 'Statusdaten veraltet',
}

export const TIMELINE_LABELS: Record<string, string> = {
  contractual_due_date: 'Vertragsfälligkeit',
  planned_date: 'Geplant',
  forecast_date: 'Forecast',
  actual_date: 'Ist',
  planned_integration: 'Integration geplant',
  forecast_integration: 'Integration Forecast',
  actual_integration: 'Integration Ist',
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

export function actionStatusLabel(status: string) {
  return ACTION_STATUS_LABELS[status] ?? status
}

export function analysisStatusLabel(status: string) {
  return ANALYSIS_STATUS_LABELS[status] ?? status
}

export function timelineLabel(key: string) {
  return TIMELINE_LABELS[key] ?? key
}

export function ruleLabel(ruleId: string) {
  return RULE_LABELS[ruleId] ?? 'Regelabweichung'
}

export function severityBadgeVariant(severity: string) {
  if (severity === 'critical') return 'critical' as const
  if (severity === 'warning') return 'warning' as const
  return 'muted' as const
}
