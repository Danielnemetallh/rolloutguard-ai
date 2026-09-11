import {
  Bot,
  FileStack,
  History,
  LayoutDashboard,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  TriangleAlert,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Mark } from '@/components/Mark'
import { cn } from '@/lib/utils'

const ROUTES = [
  { to: '/', label: 'Leitstand', icon: LayoutDashboard, end: true },
  { to: '/ausnahmen', label: 'Ausnahmen', icon: TriangleAlert },
  { to: '/dokumente', label: 'Dokumente', icon: FileStack },
  { to: '/aktionen', label: 'Aktionen', icon: ListChecks },
  { to: '/laeufe', label: 'Läufe', icon: History },
]

type NavigationSidebarProps = {
  collapsed: boolean
  onToggle: () => void
  pendingActionCount?: number
}

export function NavigationSidebar({
  collapsed,
  onToggle,
  pendingActionCount = 0,
}: NavigationSidebarProps) {
  return (
    <div className="flex h-dvh flex-col border-r border-border bg-[var(--surface-raised)]">
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Mark />
        </span>
        <div className="nav-label min-w-0">
          <p className="text-sm font-semibold leading-none">RolloutGuard</p>
          <p className="mt-1 whitespace-nowrap text-[11px] text-muted-foreground">Rollout-Kontrolle</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3" aria-label="Hauptnavigation">
        {ROUTES.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            aria-label={label}
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                isActive
                  ? 'bg-[var(--selection)] text-foreground'
                  : 'hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
            <span className="nav-label flex min-w-0 flex-1 items-center justify-between">
              <span>{label}</span>
              {label === 'Aktionen' && pendingActionCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground">
                  {pendingActionCount}
                </span>
              )}
            </span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        <div className="mb-1 flex h-9 items-center gap-3 px-3 text-xs text-muted-foreground">
          <Bot className="size-[18px] shrink-0" strokeWidth={1.8} />
          <span className="nav-label whitespace-nowrap">Nachvollziehbare Regeln</span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-controls="primary-navigation"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Navigation ausklappen' : 'Navigation einklappen'}
          title={collapsed ? 'Navigation ausklappen' : 'Navigation einklappen'}
          className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-[18px] shrink-0" />
          ) : (
            <PanelLeftClose className="size-[18px] shrink-0" />
          )}
          <span className="nav-label">Einklappen</span>
        </button>
      </div>
    </div>
  )
}
