import { Link } from 'react-router-dom'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { AgentCitation } from '../types'

type CitationListProps = {
  citations: AgentCitation[] | undefined
}

export function CitationList({ citations }: CitationListProps) {
  if (!citations || citations.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Keine überprüfbare Quelle in dieser Antwort</p>
    )
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Quellen ({citations.length})
      </p>
      <Accordion type="single" collapsible className="mt-1">
        {citations.map((c, index) => (
          <AccordionItem key={`${c.id}-${index}`} value={c.id}>
            <AccordionTrigger className="py-2 text-sm hover:no-underline">
              <span className="flex min-w-0 items-center gap-2 text-left">
                <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0 truncate">
                  {c.label}
                  <span className="text-muted-foreground"> · {c.locator}</span>
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 text-xs text-muted-foreground">
              {c.snippet && <p className="whitespace-pre-wrap text-foreground">{c.snippet}</p>}
              {c.documentId != null && (
                <Link
                  to={`/dokumente?doc=${c.documentId}`}
                  className="text-primary no-underline hover:underline"
                >
                  Dokument öffnen
                </Link>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
