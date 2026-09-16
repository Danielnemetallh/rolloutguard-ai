import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AgentSidebar } from './components/AgentSidebar'
import { Layout } from './components/Layout'
import { NavigationSidebar } from './components/NavigationSidebar'
import { WorkbenchProvider } from './context/WorkbenchContext'
import { useWorkbench } from './context/workbench'
import { useAgentViewportContext } from './hooks/useAgentViewportContext'
import { useStoredBoolean } from './hooks/useStoredBoolean'
import { DocumentsPage } from './pages/DocumentsPage'
import { ExceptionsPage } from './pages/ExceptionsPage'
import { FindingPage } from './pages/FindingPage'
import { Leitstand } from './pages/Leitstand'
import { RunsPage } from './pages/RunsPage'

const queryClient = new QueryClient()

function Shell() {
  const wb = useWorkbench()
  const viewport = useAgentViewportContext()
  const [navigationCollapsed, setNavigationCollapsed] = useStoredBoolean(
    'rolloutguard.sidebar.navigation.collapsed',
    false,
  )
  const [agentCollapsed, setAgentCollapsed] = useStoredBoolean(
    'rolloutguard.sidebar.agent.collapsed',
    true,
  )

  return (
    <Layout
      navigationCollapsed={navigationCollapsed}
      agentCollapsed={agentCollapsed}
      navigation={
        <NavigationSidebar
          collapsed={navigationCollapsed}
          onToggle={() => setNavigationCollapsed((value) => !value)}
        />
      }
      agent={
        <AgentSidebar
          collapsed={agentCollapsed}
          analysisId={wb.analysisId}
          draft={wb.question}
          turns={wb.history}
          actions={wb.actions}
          onToggle={() => setAgentCollapsed((value) => !value)}
          onNewSession={wb.startNewAgentSession}
          onShowHistory={wb.loadAgentHistory}
          historyOpen={wb.agentHistoryOpen}
          savedSessions={wb.savedAgentSessions}
          onResumeSession={wb.resumeAgentSession}
          onDeleteSession={wb.deleteAgentSession}
          onRenameSession={wb.renameAgentSession}
          onCloseHistory={wb.closeAgentHistory}
          viewport={viewport}
          onDraftChange={wb.questionChange}
          onSubmit={(question) => wb.submitQuestion(question, viewport)}
          onRetry={(turnId) => wb.retryQuestion(turnId, viewport)}
          onStop={wb.stopQuestion}
          onConfirmAction={wb.confirmAction}
          onDismissAction={wb.dismissAction}
          actionMutationPending={wb.actionMutationPending}
          projectId={wb.projectId}
          uploadPending={wb.uploadPending}
          onUploadDocument={wb.onUploadDocument}
          onEvidenceSelect={wb.highlightEvidence}
        />
      }
    >
      <Routes>
        <Route index element={<Leitstand />} />
        <Route path="ausnahmen" element={<ExceptionsPage />} />
        <Route path="dokumente" element={<DocumentsPage />} />
        <Route path="laeufe" element={<RunsPage />} />
        <Route path="befund/:id" element={<FindingPage />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <WorkbenchProvider>
          <Shell />
        </WorkbenchProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
