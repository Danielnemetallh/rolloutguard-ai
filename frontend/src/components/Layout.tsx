import type { ReactNode } from 'react'

type LayoutProps = {
  header: ReactNode
  navigation: ReactNode
  agent: ReactNode
  navigationCollapsed: boolean
  agentCollapsed: boolean
  children: ReactNode
}

export function Layout({
  header,
  navigation,
  agent,
  navigationCollapsed,
  agentCollapsed,
  children,
}: LayoutProps) {
  return (
    <div
      className={`workbench-shell ${navigationCollapsed ? 'navigation-collapsed' : ''} ${agentCollapsed ? 'agent-collapsed' : ''}`}
    >
      <aside id="primary-navigation" className="workbench-navigation" aria-label="Anwendungsnavigation">
        {navigation}
      </aside>
      <div className="min-w-0 bg-background">
        <div className="sticky top-0 z-30 border-b border-border bg-[var(--surface-raised)]">
          {header}
        </div>
        <main className="min-w-0 px-5 py-5 xl:px-7">{children}</main>
      </div>
      <aside id="evidence-agent" className="workbench-agent" aria-label="Evidenz-Copilot">
        {agent}
      </aside>
    </div>
  )
}
