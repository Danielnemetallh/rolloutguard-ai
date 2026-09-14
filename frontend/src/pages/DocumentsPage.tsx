import { FileText, Upload } from 'lucide-react'
import { useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useWorkbench } from '@/context/workbench'
import {
  isDocumentCorpusFile,
  workbookExtension,
} from '@/lib/workbookImport'
import { cn } from '@/lib/utils'

const FILE_ACCEPT =
  '.pdf,.docx,.txt,.md,.xlsx,.xlsm,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function DocumentsPage() {
  const workbench = useWorkbench()
  const inputRef = useRef<HTMLInputElement>(null)
  const [searchParams] = useSearchParams()
  const selectedDocumentId = Number(searchParams.get('dokument')) || null

  const absorbFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (files.length === 0) return

    if (files.some((file) => workbookExtension(file) === 'csv')) {
      toast.error('CSV wird nicht unterstützt. Bitte .xlsx verwenden.')
    }

    const documents = files.filter(isDocumentCorpusFile)
    const excelFiles = files.filter((file) => !isDocumentCorpusFile(file) && workbookExtension(file) !== 'csv')

    if (excelFiles.length > 0) {
      workbench.onImportWorkbooks(excelFiles)
    }

    if (documents.length === 1) {
      workbench.onUploadDocument(documents[0])
    } else if (documents.length > 1) {
      toast.error('Bitte nur ein Dokument (PDF, DOCX, TXT, Markdown) auf einmal aufnehmen.')
    }
  }

  const pending = workbench.uploadPending || workbench.importPending

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Quellen · Dokumentkorpus
          </p>
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em]">Dokumente</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Verträge und Hinweise für die überprüfbare Dokumentensuche.
          </p>
        </div>
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={!workbench.projectId || pending}
        >
          <Upload className="size-4" /> {pending ? 'Wird gelesen' : 'Dokument wählen'}
        </Button>
      </header>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept={FILE_ACCEPT}
        onChange={(event) => {
          if (event.target.files?.length) absorbFiles(event.target.files)
          event.target.value = ''
        }}
      />

      <div
        className="flex min-h-20 items-center justify-center border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] px-5 text-center text-sm text-muted-foreground"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          absorbFiles(event.dataTransfer.files)
        }}
      >
        PDF, DOCX, TXT, Markdown oder .xlsx hier ablegen. Extrahierte Inhalte bleiben
        schreibgeschützt.
      </div>

      <section className="overflow-hidden border border-border bg-[var(--surface-raised)]" aria-label="Dokumentliste">
        <header className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Aufgenommene Dokumente</h2>
        </header>
        {workbench.documentsLoading && <div className="m-4 h-12 animate-pulse bg-muted" />}
        {workbench.documentsError && (
          <div className="flex items-center justify-between px-4 py-5 text-sm text-[var(--critical)]">
            <span>Dokumente konnten nicht geladen werden.</span>
            <button className="font-medium text-primary hover:underline" onClick={workbench.retryDocuments}>
              Wiederholen
            </button>
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
              <span className="font-mono text-xs text-muted-foreground">
                {document.kind === 'xlsx' ? 'Workbook' : 'Extraktion bereit'}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {document.site_ids.length
                  ? document.site_ids.join(', ')
                  : document.kind === 'xlsx'
                    ? 'Mit vorhandenen Quellen abgeglichen'
                    : 'Keine Standort-ID erkannt'}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
