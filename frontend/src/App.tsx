import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AgentDock } from './components/AgentDock'
import { Layout } from './components/Layout'
import { TopBar } from './components/TopBar'
import { WorkbenchProvider } from './context/WorkbenchContext'
import { useWorkbench as useWorkbenchContext } from './context/workbench'
import { FindingPage } from './pages/FindingPage'
import { Leitstand } from './pages/Leitstand'

const queryClient = new QueryClient()

function Shell() {
  const wb = useWorkbenchContext()

  return (
    <Layout
      header={
        <TopBar
          isLoading={wb.isLoading}
          error={wb.error}
          analysisId={wb.analysisId}
          projectId={wb.projectId}
          analyzePending={wb.analyzePending}
          exportPending={wb.exportPending}
          onAnalyze={wb.onAnalyze}
          onExport={wb.onExport}
          onRetry={wb.retryBootstrap}
        />
      }
    >
      <Routes>
        <Route index element={<Leitstand />} />
        <Route path="befund/:id" element={<FindingPage />} />
      </Routes>
      <AgentDock
        analysisId={wb.analysisId}
        question={wb.question}
        lastQuestion={wb.lastQuestion}
        pending={wb.askPending}
        error={wb.askError}
        result={wb.askResult}
        onQuestionChange={wb.questionChange}
        onSubmit={wb.submitQuestion}
        onRetry={wb.retryQuestion}
        onEvidenceSelect={wb.highlightEvidence}
      />
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
