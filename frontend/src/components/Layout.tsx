import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type LayoutProps = {
  nav: ReactNode
  agent: ReactNode | null
  children: ReactNode
  navCollapsed: boolean
  agentOpen: boolean
  desktop: boolean
}

export function Layout({
  nav,
  agent,
  children,
  navCollapsed,
  agentOpen,
  desktop,
}: LayoutProps) {
  const navWidth = navCollapsed ? '72px' : '224px'
  const agentWidth = desktop && agentOpen ? '400px' : '0px'

  return (
    <div
      className={cn(
        'workbench-shell grid min-h-dvh bg-background',
        navCollapsed && 'navigation-collapsed',
        !agentOpen && 'agent-collapsed',
      )}
      style={{
        gridTemplateColumns: `${navWidth} minmax(0, 1fr) ${agentWidth}`,
      }}
    >
      {nav}
      <div className="min-w-0 bg-background">
        <main className="min-w-0 px-5 py-5 xl:px-7">{children}</main>
      </div>
      {agentOpen && agent}
    </div>
  )
}
