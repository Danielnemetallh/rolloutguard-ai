import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AgentSidebar } from './components/AgentSidebar'
import { Layout } from './components/Layout'
import { NavigationSidebar } from './components/NavigationSidebar'
import { TopBar } from './components/TopBar'
import { WorkbenchProvider } from './context/WorkbenchContext'
import { useWorkbench } from './context/workbench'
import { useStoredBoolean } from './hooks/useStoredBoolean'
import { ActionsPage } from './pages/ActionsPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { ExceptionsPage } from './pages/ExceptionsPage'
import { FindingPage } from './pages/FindingPage'
import { Leitstand } from './pages/Leitstand'
import { RunsPage } from './pages/RunsPage'

const queryClient = new QueryClient()

function Shell() {
  const wb = useWorkbench()
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
          pendingActionCount={wb.pendingActionCount}
          onToggle={() => setNavigationCollapsed((value) => !value)}
        />
      }
      header={
        <TopBar
          isLoading={wb.isLoading}
          error={wb.error}
          analysisId={wb.analysisId}
          projectId={wb.projectId}
          analyzePending={wb.analyzePending}
          exportPending={wb.exportPending}
          uploadPending={wb.uploadPending}
          documentsCount={wb.documents.length}
          integrations={wb.integrations}
          onAnalyze={wb.onAnalyze}
          onExport={wb.onExport}
          onUploadDocument={wb.onUploadDocument}
          onConnect={wb.onConnect}
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
          onDraftChange={wb.questionChange}
          onSubmit={wb.submitQuestion}
          onRetry={wb.retryQuestion}
          onConfirmAction={wb.confirmAction}
          onEvidenceSelect={wb.highlightEvidence}
        />
      }
    >
      <Routes>
        <Route index element={<Leitstand />} />
        <Route path="ausnahmen" element={<ExceptionsPage />} />
        <Route path="dokumente" element={<DocumentsPage />} />
        <Route path="aktionen" element={<ActionsPage />} />
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
