import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { API_BASE } from '@/lib/api'
import type { ProposedAction } from '../types'

const TYPE_LABELS: Record<string, string> = {
  calendar: 'Kalender',
  email: 'E-Mail',
  briefing: 'Briefing',
  digest: 'Digest',
  board: 'Karte',
  task: 'Aufgabe',
  override: 'Override',
  watch: 'Watch',
  watch_fire: 'Watch-Erinnerung',
}

type ActionsQueueProps = {
  projectId: number | undefined
}

export function ActionsQueue({ projectId }: ActionsQueueProps) {
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['actions', projectId],
    enabled: projectId != null,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}/actions`)
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ actions: ProposedAction[] }>
    },
    refetchInterval: 8000,
  })

  const confirm = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/api/actions/${id}/confirm`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
      toast.success('Freigegeben')
      void qc.invalidateQueries({ queryKey: ['actions'] })
    },
    onError: () => toast.error('Freigabe fehlgeschlagen'),
  })

  const dismiss = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/api/actions/${id}/dismiss`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => {
      toast.success('Verworfen')
      void qc.invalidateQueries({ queryKey: ['actions'] })
    },
  })

  const drafts = (list.data?.actions ?? []).filter((a) => a.status === 'draft')
  const badge = drafts.filter((a) => a.action_type === 'watch_fire').length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-sm">Aktionsqueue</CardTitle>
        {badge > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
            {badge} Watch
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {drafts.length === 0 && (
          <p className="text-sm text-muted-foreground">Keine offenen Entwürfe.</p>
        )}
        {drafts.map((action) => (
          <div
            key={action.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">
                {TYPE_LABELS[action.action_type] ?? action.action_type} #{action.id}
              </p>
              <p className="text-xs text-muted-foreground">
                {(action.site_ids ?? []).join(', ') || '—'} ·{' '}
                {String(action.payload.title ?? action.payload.subject ?? action.payload.message ?? '')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => confirm.mutate(action.id)} disabled={confirm.isPending}>
                Freigeben
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => dismiss.mutate(action.id)}
                disabled={dismiss.isPending}
              >
                Verwerfen
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
