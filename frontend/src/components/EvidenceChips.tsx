import { Badge } from '@/components/ui/badge'

type EvidenceChipsProps = {
  ids: string[]
  onSelect?: (id: string) => void
  label?: string
}

export function EvidenceChips({ ids, onSelect, label = 'Evidenz' }: EvidenceChipsProps) {
  if (!ids.length) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      {ids.map((id) =>
        onSelect ? (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className="rounded-md focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Badge variant="outline" className="cursor-pointer font-mono hover:bg-accent">
              {id}
            </Badge>
          </button>
        ) : (
          <Badge key={id} variant="outline" className="font-mono">
            {id}
          </Badge>
        ),
      )}
    </div>
  )
}
