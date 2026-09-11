import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { AgentSidebar } from './components/AgentSidebar'
import { Layout } from './components/Layout'
import { SideNav } from './components/SideNav'
import { Sheet, SheetContent } from './components/ui/sheet'
import { TooltipProvider } from './components/ui/tooltip'
import { WorkbenchProvider, useWorkbench } from './context/WorkbenchContext'
import { useSidebarPrefs } from './hooks/useSidebarPrefs'
import { useTheme } from './hooks/useTheme'
import { pageContextLabel } from './lib/pageContext'
import { ActionsPage } from './pages/ActionsPage'
import { AusnahmenPage } from './pages/AusnahmenPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { FindingPage } from './pages/FindingPage'
import { LaeufePage } from './pages/LaeufePage'
import { Leitstand } from './pages/Leitstand'

const queryClient = new QueryClient()

function Shell() {
  const wb = useWorkbench()
  const sidebars = useSidebarPrefs()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [params] = useSearchParams()
  const befundId = params.get('befund')
  const contextLabel = pageContextLabel(location.pathname, befundId)

  const agentPanel = (
    <AgentSidebar
      onClose={sidebars.toggleAgent}
      analysisId={wb.analysisId}
      question={wb.question}
      pending={wb.askPending}
      history={wb.history}
      sessions={wb.sessions}
      activeSessionTitle={wb.activeSessionTitle}
      pageContextLabel={contextLabel}
      actions={wb.actions}
      confirmPending={wb.confirmPending}
      dismissPending={wb.dismissPending}
      integrations={wb.integrations}
      onQuestionChange={wb.questionChange}
      onSubmit={(q) => wb.submitQuestion(q, contextLabel)}
      onRetry={(turn) => wb.retryTurn(turn, contextLabel)}
      onNewChat={wb.startNewChat}
      onSelectSession={wb.selectSession}
      onConfirm={wb.onConfirmAction}
      onDismiss={wb.onDismissAction}
      onConnect={wb.onConnect}
      onUploadDocument={wb.onUploadDocument}
    />
  )

  return (
    <Layout
      navCollapsed={sidebars.navCollapsed}
      agentOpen={!sidebars.agentCollapsed}
      desktop={sidebars.desktop}
      nav={
        <SideNav collapsed={sidebars.navCollapsed} onToggle={sidebars.toggleNav} />
      }
      agent={sidebars.desktop && !sidebars.agentCollapsed ? agentPanel : null}
    >
      <Routes>
        <Route
          index
          element={
            <Leitstand
              theme={theme}
              onThemeToggle={toggleTheme}
              agentOpen={!sidebars.agentCollapsed}
              onAgentToggle={sidebars.toggleAgent}
            />
          }
        />
        <Route
          path="ausnahmen"
          element={
            <AusnahmenPage
              theme={theme}
              onThemeToggle={toggleTheme}
              agentOpen={!sidebars.agentCollapsed}
              onAgentToggle={sidebars.toggleAgent}
            />
          }
        />
        <Route path="dokumente" element={<DocumentsPage />} />
        <Route path="aktionen" element={<ActionsPage />} />
        <Route path="laeufe" element={<LaeufePage />} />
        <Route path="befund/:id" element={<FindingPage />} />
      </Routes>
      {!sidebars.desktop && (
        <Sheet
          open={!sidebars.agentCollapsed}
          onOpenChange={(open) => {
            if (open && sidebars.agentCollapsed) sidebars.toggleAgent()
            if (!open && !sidebars.agentCollapsed) sidebars.toggleAgent()
          }}
        >
          <SheetContent side="right" className="w-[min(100vw-2rem,400px)] p-0">
            {agentPanel}
          </SheetContent>
        </Sheet>
      )}
    </Layout>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <WorkbenchProvider>
            <Shell />
          </WorkbenchProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
