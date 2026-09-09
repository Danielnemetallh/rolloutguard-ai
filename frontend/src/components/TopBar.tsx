import type { Meta } from '../types'

type TopBarProps = {
  meta: Meta | undefined
  isLoading: boolean
  error: Error | null
  analysisId: number | null
  projectId: number | undefined
  analyzePending: boolean
  exportPending: boolean
  onAnalyze: () => void
  onExport: () => void
}

export function TopBar({
  meta,
  isLoading,
  error,
  analysisId,
  projectId,
  analyzePending,
  exportPending,
  onAnalyze,
  onExport,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="topbar-mark" aria-hidden="true">RG</div>
        <div>
          <p className="topbar-title">RolloutGuard</p>
          <p className="topbar-sub">Exception queue</p>
        </div>
      </div>
      <div className="topbar-meta">
        {isLoading && <span>Connecting…</span>}
        {error && (
          <span className="warn">
            API offline. Start with <code className="mono">scripts/dev-api.ps1</code>.
          </span>
        )}
        {meta && !error && (
          <>
            <span>
              <strong>{meta.user.display_name}</strong> · {meta.user.role}
            </span>
            <span>
              LLM: {meta.llm_enabled ? meta.llm_model : 'deterministic mock'}
            </span>
            {analysisId != null && <span>Run #{analysisId}</span>}
          </>
        )}
      </div>
      <div className="topbar-actions">
        <button
          type="button"
          className="primary"
          disabled={!projectId || analyzePending}
          onClick={onAnalyze}
        >
          {analyzePending ? 'Analyzing…' : 'Run analysis'}
        </button>
        <button
          type="button"
          disabled={!analysisId || exportPending}
          onClick={onExport}
        >
          {exportPending ? 'Exporting…' : 'Export'}
        </button>
      </div>
    </header>
  )
}
