import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AgentSidebar } from '@/components/AgentSidebar'
import { CitationList } from '@/components/CitationList'
import { NavigationSidebar } from '@/components/NavigationSidebar'
import { SelectedFindingTimeline } from '@/components/SelectedFindingTimeline'
import { useStoredBoolean } from '@/hooks/useStoredBoolean'
import { useAgentAsk } from '@/hooks/useAgentAsk'
import type { AgentTurn, Finding } from '@/types'

const finding: Finding = {
  id: 17,
  site_id: 'DE-NRW-0107',
  rule_id: 'SLA-001',
  severity: 'critical',
  status: 'open',
  message: 'Forecast liegt nach der vertraglichen Fälligkeit.',
  facts: { contractual_due_date: '2026-09-15' },
  evidence: [],
}

function PreferenceProbe({ storageKey, fallback }: { storageKey: string; fallback: boolean }) {
  const [value, setValue] = useStoredBoolean(storageKey, fallback)
  return <button onClick={() => setValue((current) => !current)}>{String(value)}</button>
}

describe('workbench shell behavior', () => {
  it('uses defaults for missing or invalid sidebar preferences and stores toggles independently', async () => {
    localStorage.clear()
    localStorage.setItem('invalid', 'maybe')
    const user = userEvent.setup()
    const { rerender } = render(<PreferenceProbe storageKey="navigation" fallback={false} />)
    expect(screen.getByRole('button')).toHaveTextContent('false')
    await user.click(screen.getByRole('button'))
    expect(localStorage.getItem('navigation')).toBe('true')

    rerender(<PreferenceProbe storageKey="invalid" fallback={true} />)
    expect(screen.getByRole('button')).toHaveTextContent('true')
  })

  it('retains accessible route names when navigation is collapsed', () => {
    render(
      <MemoryRouter initialEntries={['/ausnahmen']}>
        <NavigationSidebar collapsed onToggle={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Ausnahmen' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Navigation ausklappen' })).toBeInTheDocument()
  })
})

describe('agent sidebar', () => {
  const completeTurn: AgentTurn = {
    id: 'turn-1',
    analysisRunId: 4,
    question: 'Welche Quelle belegt das?',
    status: 'complete',
    result: {
      provider: 'mock',
      result: {
        answer: 'Der Termin stammt aus dem Vertrag.',
        site_ids: [],
        evidence_ids: [],
        memory_ids: [],
        citations: [],
        proposed_action_ids: [],
        tool_trace: [],
        abstained: false,
        confidence: 0.9,
      },
    },
  }

  it('renders user and agent messages as separate labeled regions', () => {
    render(
      <AgentSidebar
        collapsed={false}
        analysisId={4}
        draft=""
        turns={[completeTurn]}
        actions={[]}
        onToggle={vi.fn()}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
        onRetry={vi.fn()}
        onConfirmAction={vi.fn()}
        onEvidenceSelect={vi.fn()}
      />,
    )
    expect(screen.getByRole('region', { name: 'Nachricht von Sie' })).toHaveTextContent(
      completeTurn.question,
    )
    expect(screen.getByRole('region', { name: 'Antwort von Evidenz-Copilot' })).toHaveTextContent(
      'Der Termin stammt aus dem Vertrag.',
    )
  })

  it('shows the pending response beneath the submitted user message', () => {
    render(
      <AgentSidebar
        collapsed={false}
        analysisId={4}
        draft=""
        turns={[{ ...completeTurn, id: 'pending', status: 'pending', result: undefined }]}
        actions={[]}
        onToggle={vi.fn()}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
        onRetry={vi.fn()}
        onConfirmAction={vi.fn()}
        onEvidenceSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('Antwort wird erstellt')).toBeInTheDocument()
  })

  it('keeps drafts and transcripts separated by analysis run', async () => {
    const responseResult = completeTurn.result!
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => responseResult }),
    )
    const { result, rerender } = renderHook(
      ({ analysisId }) => useAgentAsk(analysisId),
      { initialProps: { analysisId: 4 as number | null } },
    )

    act(() => result.current.questionChange('Welche Quelle belegt das?'))
    act(() => result.current.submitQuestion())
    expect(result.current.question).toBe('')
    expect(result.current.history[0]).toMatchObject({
      analysisRunId: 4,
      question: 'Welche Quelle belegt das?',
      status: 'pending',
    })
    await waitFor(() => expect(result.current.history[0].status).toBe('complete'))

    rerender({ analysisId: 5 })
    expect(result.current.history).toEqual([])
    act(() => result.current.questionChange('Entwurf für Lauf fünf'))
    expect(result.current.question).toBe('Entwurf für Lauf fünf')

    rerender({ analysisId: 4 })
    expect(result.current.history).toHaveLength(1)
    expect(result.current.question).toBe('')
    vi.unstubAllGlobals()
  })
})

describe('progressive citations', () => {
  it('starts collapsed and only expands one citation at a time', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <CitationList
          citations={[
            {
              id: 'E-CONTRACT-1',
              sourceKind: 'workbook_cell',
              label: 'contract.xlsx',
              locator: 'Obligations, Zeile 2',
              snippet: '15.09.2026',
              evidenceId: 'E-CONTRACT-1',
              documentId: null,
            },
            {
              id: 'doc:2#c0',
              sourceKind: 'document_chunk',
              label: 'vertrag.pdf',
              locator: 'Abschnitt 1',
              snippet: 'Fibre-Ready erforderlich',
              evidenceId: null,
              documentId: 2,
            },
          ]}
          onEvidenceSelect={vi.fn()}
        />
      </MemoryRouter>,
    )
    expect(screen.queryByText('15.09.2026')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /contract.xlsx/ }))
    expect(screen.getByText('15.09.2026')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /vertrag.pdf/ }))
    expect(screen.queryByText('15.09.2026')).not.toBeInTheDocument()
    expect(screen.getByText('Fibre-Ready erforderlich')).toBeInTheDocument()
  })

  it('shows an explicit fallback when no validated citation exists', () => {
    render(<CitationList citations={[]} />)
    expect(screen.getByText('Keine überprüfbare Quelle in dieser Antwort')).toBeInTheDocument()
  })
})

describe('selected finding timeline', () => {
  it('renders nothing until a finding is selected', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SelectedFindingTimeline finding={null} analysisId={4} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('keeps the selected finding when its timeline is collapsed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          site_id: finding.site_id,
          partner_id: 'NordTurm',
          timeline: { contractual_due_date: '2026-09-15' },
          evidence: [],
          findings: [finding],
        }),
      }),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SelectedFindingTimeline finding={finding} analysisId={4} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Projektverlauf · DE-NRW-0107')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Projektverlauf einklappen' }))
    expect(screen.getByText('Projektverlauf · DE-NRW-0107')).toBeInTheDocument()
    expect(screen.queryByText('15.09.2026')).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
