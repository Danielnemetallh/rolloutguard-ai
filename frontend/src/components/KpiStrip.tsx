type KpiStripProps = {
  kpis: Record<string, number> | undefined
}

function percentOnPlan(kpis: Record<string, number>) {
  const sites = Number(kpis.sites_total ?? 0)
  if (sites <= 0) return null
  const atRisk = Number(kpis.sites_with_sla_risk ?? 0)
  return Math.max(0, Math.round((100 * (sites - atRisk)) / sites))
}

export function KpiStrip({ kpis }: KpiStripProps) {
  if (!kpis) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        Analyse starten, um Workbooks in die Ausnahme-Warteschlange zu überführen.
      </p>
    )
  }

  const onPlan = percentOnPlan(kpis)

  return (
    <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4" aria-label="Kennzahlen">
      <Kpi label="Standorte" value={kpis.sites_total} />
      <Kpi label="Kritisch" value={kpis.findings_critical} tone="critical" />
      <Kpi label="Warnungen" value={kpis.findings_warning} tone="warn" />
      <Kpi label="Im Plan" value={onPlan} suffix="%" tone="ok" />
    </div>
  )
}

function Kpi({
  label,
  value,
  suffix = '',
  tone,
}: {
  label: string
  value: number | null | undefined
  suffix?: string
  tone?: 'critical' | 'warn' | 'ok'
}) {
  const color =
    tone === 'critical'
      ? 'text-[var(--critical)]'
      : tone === 'warn'
        ? 'text-[var(--warn)]'
        : tone === 'ok'
          ? 'text-[var(--approved)]'
          : 'text-foreground'

  return (
    <div className="px-4 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-mono text-lg font-semibold tabular-nums leading-tight ${color}`}>
        {value ?? 'k. A.'}
        {value != null ? suffix : ''}
      </p>
    </div>
  )
}
