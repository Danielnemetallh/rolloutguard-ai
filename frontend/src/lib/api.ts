export const API_BASE = import.meta.env.VITE_API_BASE ?? ''
export const ANALYSIS_KEY = 'rg-analysis-id'

export function readStoredAnalysisId(): number | null {
  const raw = sessionStorage.getItem(ANALYSIS_KEY)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function apiErrorMessage(text: string, fallback: string) {
  try {
    const parsed = JSON.parse(text) as { message?: string }
    if (parsed.message?.trim()) return parsed.message.trim()
  } catch {
    /* not JSON */
  }
  const trimmed = text.trim()
  if (trimmed && trimmed.length <= 180) return trimmed
  return fallback
}

export function workbookUploadName(file: File) {
  const name = file.name.trim() || 'workbook'
  if (/\.xlsx$/i.test(name) || /\.xlsm$/i.test(name)) return name
  return `${name}.xlsx`
}
