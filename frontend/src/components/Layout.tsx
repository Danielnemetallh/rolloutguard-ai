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
      <div className="workbench-canvas">
        <div className="workbench-commandbar">
          {header}
        </div>
        <main className="workbench-main">{children}</main>
      </div>
      <aside id="evidence-agent" className="workbench-agent" aria-label="Evidenz-Copilot">
        {agent}
      </aside>
    </div>
  )
}
