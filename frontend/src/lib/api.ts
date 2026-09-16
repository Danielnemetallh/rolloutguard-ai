export const API_BASE = import.meta.env.VITE_API_BASE ?? ''
export const ANALYSIS_KEY = 'rg-analysis-id'

export class ApiError extends Error {
  readonly code: string | undefined
  readonly details: Record<string, unknown>

  constructor(message: string, code?: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

export function describeApiError(error: Error): string {
  if (error instanceof ApiError && error.code) return `[${error.code}] ${error.message}`
  return error.message
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init)
  if (response.ok) return response.json() as Promise<T>

  let body: { code?: string; message?: string; details?: Record<string, unknown> } | undefined
  try {
    body = (await response.json()) as typeof body
  } catch {
    body = undefined
  }

  throw new ApiError(
    body?.message ?? `API-Anfrage fehlgeschlagen (${response.status})`,
    body?.code,
    body?.details ?? {},
  )
}

export function readStoredAnalysisId(): number | null {
  const raw = sessionStorage.getItem(ANALYSIS_KEY)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
