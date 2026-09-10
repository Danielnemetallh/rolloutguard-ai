import { ChevronRight, FileText, Sheet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { AgentCitation } from '@/types'

type CitationListProps = {
  citations: AgentCitation[]
  onEvidenceSelect?: (evidenceId: string) => void
}

export function CitationList({ citations, onEvidenceSelect }: CitationListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  if (citations.length === 0) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Keine überprüfbare Quelle in dieser Antwort
      </p>
    )
  }

  return (
    <section className="mt-4 border-t border-border pt-3" aria-label="Überprüfte Quellen">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        Quellen ({citations.length})
      </p>
      <div className="divide-y divide-border rounded-md border border-border bg-[var(--surface-raised)]">
        {citations.map((citation) => {
          const expanded = expandedId === citation.id
          return (
            <div key={citation.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40"
                aria-expanded={expanded}
                onClick={() => setExpandedId(expanded ? null : citation.id)}
              >
                {citation.sourceKind === 'workbook_cell' ? (
                  <Sheet className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium">{citation.label}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {citation.locator}
                </span>
                <ChevronRight
                  className={cn('size-3.5 shrink-0 transition-transform duration-150', expanded && 'rotate-90')}
                />
              </button>
              {expanded && (
                <div className="space-y-2 border-t border-border bg-muted/35 px-3 py-2.5 text-xs">
                  <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                    {citation.snippet ?? 'Für diese Quelle ist kein Auszug gespeichert.'}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="font-mono text-[10px] text-muted-foreground">{citation.id}</code>
                    {citation.evidenceId && onEvidenceSelect && (
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => onEvidenceSelect(citation.evidenceId!)}
                      >
                        Quellzelle zeigen
                      </button>
                    )}
                    {citation.documentId != null && (
                      <Link
                        to={`/dokumente?dokument=${citation.documentId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        Dokument öffnen
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
