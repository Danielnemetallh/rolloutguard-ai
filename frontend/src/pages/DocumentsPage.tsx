import { FileText, Upload } from 'lucide-react'
import { useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useWorkbench } from '@/context/workbench'
import { cn } from '@/lib/utils'

export function DocumentsPage() {
  const workbench = useWorkbench()
  const inputRef = useRef<HTMLInputElement>(null)
  const [searchParams] = useSearchParams()
  const selectedDocumentId = Number(searchParams.get('dokument')) || null

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em]">Dokumente</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Verträge und Hinweise für die überprüfbare Dokumentensuche.
          </p>
        </div>
        <Button onClick={() => inputRef.current?.click()} disabled={!workbench.projectId || workbench.uploadPending}>
          <Upload className="size-4" /> {workbench.uploadPending ? 'Wird gelesen' : 'Dokument wählen'}
        </Button>
      </header>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.txt,.md,application/pdf"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) workbench.onUploadDocument(file)
          event.target.value = ''
        }}
      />
      <div
        className="flex min-h-28 items-center justify-center border border-dashed border-border bg-[var(--surface-raised)] px-5 text-center text-sm text-muted-foreground"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files[0]
          if (file) workbench.onUploadDocument(file)
        }}
      >
        PDF, DOCX, TXT oder Markdown hier ablegen. Extrahierte Inhalte bleiben schreibgeschützt.
      </div>
      <section className="overflow-hidden border border-border bg-[var(--surface-raised)]" aria-label="Dokumentliste">
        <header className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Aufgenommene Dokumente</h2></header>
        {workbench.documentsLoading && <div className="m-4 h-12 animate-pulse bg-muted" />}
        {workbench.documentsError && (
          <div className="flex items-center justify-between px-4 py-5 text-sm text-[var(--critical)]">
            <span>Dokumente konnten nicht geladen werden.</span>
            <button className="font-medium text-primary hover:underline" onClick={workbench.retryDocuments}>Wiederholen</button>
          </div>
        )}
        {!workbench.documentsLoading && !workbench.documentsError && workbench.documents.length === 0 && (
          <p className="px-4 py-8 text-sm text-muted-foreground">Noch keine Dokumente aufgenommen.</p>
        )}
        <div className="divide-y divide-border">
          {workbench.documents.map((document) => (
            <article
              key={document.id}
              className={cn(
                'grid min-h-14 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_160px_1fr] sm:items-center',
                selectedDocumentId === document.id && 'bg-[var(--selection)]',
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium">{document.filename}</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">Extraktion bereit</span>
              <span className="truncate text-xs text-muted-foreground">
                {document.site_ids.length ? document.site_ids.join(', ') : 'Keine Standort-ID erkannt'}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
