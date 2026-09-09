export const API_BASE = import.meta.env.VITE_API_BASE ?? ''
export const ANALYSIS_KEY = 'rg-analysis-id'

export function readStoredAnalysisId(): number | null {
  const raw = sessionStorage.getItem(ANALYSIS_KEY)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
