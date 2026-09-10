import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Mark } from '@/components/Mark'
import { Button } from '@/components/ui/button'
import type { IntegrationStatus } from '../types'

type TopBarProps = {
  isLoading: boolean
  error: Error | null
  analysisId: number | null
  projectId: number | undefined
  analyzePending: boolean
  exportPending: boolean
  uploadPending: boolean
  documentsCount: number
  integrations: IntegrationStatus | undefined
  onAnalyze: () => void
  onExport: () => void
  onUploadDocument: (file: File) => void
  onConnect: () => void
}

export function TopBar({
  isLoading,
  error,
  analysisId,
  projectId,
  analyzePending,
  exportPending,
  uploadPending,
  documentsCount,
  integrations,
  onAnalyze,
  onExport,
  onUploadDocument,
  onConnect,
}: TopBarProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const connected = integrations?.connected ?? false
  const sessionReady = integrations?.session_ready ?? false
  const oauthNeeded = integrations?.oauth_needed ?? false
  const showConnect =
    oauthNeeded || (integrations?.composio_configured && !sessionReady)
  const modeLabel = connected
    ? 'Composio verbunden'
    : sessionReady && oauthNeeded
      ? 'Composio · OAuth fehlt'
      : integrations?.composio_configured
        ? integrations?.composio_sdk_installed === false
          ? 'Composio-Key OK · SDK fehlt'
          : 'Composio · Session fehlt'
        : 'Datei-Fallback'

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
      <Link to="/" className="flex min-w-0 items-center gap-2.5 text-inherit no-underline">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/5 text-primary">
          <Mark />
        </span>
        <div>
          <p className="font-heading text-lg font-medium leading-none tracking-tight text-foreground">
            RolloutGuard
          </p>
          <p className="mt-1 text-xs leading-none text-muted-foreground">
            Ausnahmen statt Dauerprüfung
          </p>
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        {isLoading && <span className="text-sm text-muted-foreground">Verbinde…</span>}
        {error && (
          <span className="text-sm text-[var(--warn)]">
            API offline — <code className="font-mono text-xs">scripts/dev-api.ps1</code>
          </span>
        )}
        <span className="hidden text-xs text-muted-foreground sm:inline" title={integrations?.connect_hint}>
          {modeLabel}
          {documentsCount > 0 ? ` · ${documentsCount} Dok.` : ''}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUploadDocument(file)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!projectId || uploadPending}
          onClick={() => fileRef.current?.click()}
        >
          {uploadPending ? 'Lade…' : 'Dokumente'}
        </Button>
        {showConnect && (
          <Button type="button" variant="outline" onClick={onConnect}>
            Composio verbinden
          </Button>
        )}
        <Button
          type="button"
          disabled={!projectId || analyzePending}
          onClick={onAnalyze}
          className="rounded-full"
        >
          {analyzePending ? 'Analysiere…' : 'Analyse starten'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!analysisId || exportPending}
          onClick={onExport}
        >
          {exportPending ? 'Exportiere…' : 'Export'}
        </Button>
      </div>
    </header>
  )
}
