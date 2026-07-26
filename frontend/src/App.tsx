import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import './App.css'

const queryClient = new QueryClient()
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

type Meta = {
  name: string
  demo_mode: boolean
  synthetic_data: boolean
  disclaimer: string
  user: { display_name: string; role: string }
  llm_enabled: boolean
  llm_model: string
}

function Shell() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['meta'],
    queryFn: async (): Promise<Meta> => {
      const res = await fetch(`${API_BASE}/api/meta`)
      if (!res.ok) throw new Error(`API ${res.status}`)
      return res.json()
    },
    retry: 1,
  })

  return (
    <div className="app">
      <div className="banner" role="status">
        Demo mode — synthetic data only. Not affiliated with any operator.
      </div>
      <header className="header">
        <div>
          <p className="eyebrow">RolloutGuard AI</p>
          <h1>Evidence-linked rollout controls</h1>
          <p className="lede">
            Reconcile contract, schedule, and site-status workbooks into a
            traceable exception queue.
          </p>
        </div>
        <div className="meta-card">
          {isLoading && <p>Connecting to API…</p>}
          {error && (
            <p className="warn">
              API offline. Start the backend with{' '}
              <code>scripts/dev-api.ps1</code>.
            </p>
          )}
          {data && (
            <>
              <p>
                <strong>{data.user.display_name}</strong> · {data.user.role}
              </p>
              <p>
                LLM: {data.llm_enabled ? data.llm_model : 'deterministic mock'}
              </p>
            </>
          )}
        </div>
      </header>
      <main className="panels">
        <section>
          <h2>1. Import</h2>
          <p>Upload three synthetic workbooks and confirm column mappings.</p>
        </section>
        <section>
          <h2>2. Findings</h2>
          <p>Review deterministic milestone, SLA, and data-quality exceptions.</p>
        </section>
        <section>
          <h2>3. Evidence</h2>
          <p>Trace every finding to file, sheet, row, and cell.</p>
        </section>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  )
}
