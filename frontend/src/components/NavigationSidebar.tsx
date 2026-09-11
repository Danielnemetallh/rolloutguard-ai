import {
  FileStack,
  History,
  LayoutDashboard,
  PanelLeftOpen,
  TriangleAlert,
  X,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Mark } from '@/components/Mark'
import { cn } from '@/lib/utils'

const ROUTES = [
  { to: '/', label: 'Leitstand', icon: LayoutDashboard, end: true },
  { to: '/ausnahmen', label: 'Ausnahmen', icon: TriangleAlert },
  { to: '/dokumente', label: 'Dokumente', icon: FileStack },
  { to: '/laeufe', label: 'Läufe', icon: History },
]

type NavigationSidebarProps = {
  collapsed: boolean
  onToggle: () => void
}

export function NavigationSidebar({
  collapsed,
  onToggle,
}: NavigationSidebarProps) {
  return (
    <div className="flex h-dvh flex-col border-r border-border bg-[var(--surface-raised)]">
      <div
        className={cn(
          'flex h-14 items-center border-b border-border',
          collapsed ? 'justify-center px-2' : 'gap-3 px-4',
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            aria-controls="primary-navigation"
            aria-expanded={false}
            aria-label="Navigation ausklappen"
            title="Navigation ausklappen"
            className="group relative flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Mark className="transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0" />
            <PanelLeftOpen
              className="absolute size-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden="true"
            />
          </button>
        ) : (
          <>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Mark />
            </span>
            <div className="nav-label min-w-0 flex-1">
              <p className="text-sm font-semibold leading-none">RolloutGuard</p>
              <p className="mt-1 whitespace-nowrap text-[11px] text-muted-foreground">Rollout-Kontrolle</p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              aria-controls="primary-navigation"
              aria-expanded={true}
              aria-label="Navigation einklappen"
              title="Navigation einklappen"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <X className="size-4" />
            </button>
          </>
        )}
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
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
