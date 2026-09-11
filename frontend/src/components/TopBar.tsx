import { useRef } from 'react'
import { Circle, FileUp, Play, Share } from 'lucide-react'
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
    <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-5 xl:px-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Circle className="size-2 fill-[var(--success)] text-[var(--success)]" />
        <span>{analysisId ? `Lauf #${analysisId}` : 'Analyse ausstehend'}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isLoading && <span className="text-sm text-muted-foreground">Verbinde…</span>}
        {error && (
          <span className="text-sm text-[var(--warn)]">
            API offline. <code className="font-mono text-xs">scripts/dev-api.ps1</code>
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
          size="sm"
          variant="outline"
          disabled={!projectId || uploadPending}
          onClick={() => fileRef.current?.click()}
        >
          <FileUp className="size-4" /> {uploadPending ? 'Lade…' : 'Dokument'}
        </Button>
        {showConnect && (
          <Button type="button" size="sm" variant="outline" onClick={onConnect}>
            Composio verbinden
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          disabled={!projectId || analyzePending}
          onClick={onAnalyze}
        >
          <Play className="size-4" /> {analyzePending ? 'Analysiere…' : 'Analyse starten'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!analysisId || exportPending}
          onClick={onExport}
        >
          <Share className="size-4" /> {exportPending ? 'Exportiere…' : 'Export'}
        </Button>
      </div>
    </header>
  )
}
