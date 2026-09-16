import { QueueWorkspace } from '@/components/QueueWorkspace'

export function ExceptionsPage() {
  return (
    <div className="space-y-5">
      <header>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Prüfung · Vollständige Queue</p>
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em]">Ausnahmen</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Durchsuchen, sortieren und prüfen Sie die vollständige regelbasierte Warteschlange.
        </p>
      </header>
      <QueueWorkspace />
    </div>
  )
}
