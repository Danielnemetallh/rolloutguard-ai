import { useState } from 'react'
import {
  AlertTriangle,
  FileText,
  History,
  LayoutDashboard,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Mark } from '@/components/Mark'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/', label: 'Leitstand', icon: LayoutDashboard, end: true },
  { to: '/ausnahmen', label: 'Ausnahmen', icon: AlertTriangle },
  { to: '/dokumente', label: 'Dokumente', icon: FileText },
  { to: '/aktionen', label: 'Aktionen', icon: ListChecks },
  { to: '/laeufe', label: 'Läufe', icon: History },
] as const

type SideNavProps = {
  collapsed: boolean
  onToggle: () => void
}

export function SideNav({ collapsed, onToggle }: SideNavProps) {
  const [logoHover, setLogoHover] = useState(false)

  return (
    <aside id="primary-navigation" className="min-h-dvh border-r border-border bg-[var(--surface-raised)]">
      <div className="flex h-dvh flex-col">
        <div
          className={cn(
            'flex h-16 items-center gap-3 border-b border-border px-5',
            collapsed && 'justify-center px-3',
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="group relative flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary transition-colors hover:bg-primary/15"
                aria-controls="primary-navigation"
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Navigation ausklappen' : 'Navigation einklappen'}
                onClick={onToggle}
                onMouseEnter={() => setLogoHover(true)}
                onMouseLeave={() => setLogoHover(false)}
              >
                <Mark />
                {logoHover && (
                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm">
                    {collapsed ? (
                      <PanelLeftOpen className="size-2.5" strokeWidth={2} />
                    ) : (
                      <PanelLeftClose className="size-2.5" strokeWidth={2} />
                    )}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? 'Navigation ausklappen' : 'Navigation einklappen'}
            </TooltipContent>
          </Tooltip>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">RolloutGuard</p>
              <p className="truncate text-xs text-muted-foreground">Evidenz-Operations</p>
            </div>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Hauptnavigation">
          {LINKS.map((link) => (
            <Tooltip key={link.to} disableHoverableContent={!collapsed}>
              <TooltipTrigger asChild>
                <NavLink
                  to={link.to}
                  end={'end' in link ? link.end : false}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm no-underline transition-colors duration-150',
                      collapsed && 'justify-center px-2',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  <link.icon className="size-4 shrink-0" strokeWidth={2} />
                  <span className={cn('truncate', collapsed && 'sr-only')}>{link.label}</span>
                </NavLink>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">{link.label}</TooltipContent>}
            </Tooltip>
          ))}
        </nav>
      </div>
    </aside>
  )
}
