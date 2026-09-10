import { QueueWorkspace } from '@/components/QueueWorkspace'

export function ExceptionsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em]">Ausnahmen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Durchsuchen, sortieren und prüfen Sie die vollständige regelbasierte Warteschlange.
        </p>
      </header>
      <QueueWorkspace />
    </div>
  )
}
