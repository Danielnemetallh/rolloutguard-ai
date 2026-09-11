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
import { findingIdFromLocation, pageLabelFromPathname, visibleFindingsForPage } from '@/hooks/useAgentViewportContext'
import { useAgentAsk } from '@/hooks/useAgentAsk'
import type { AgentTurn, Finding, ProposedAction } from '@/types'

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
    expect(screen.queryByRole('link', { name: 'Aktionen' })).not.toBeInTheDocument()
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

  it('renders only a floating launcher when collapsed', () => {
    render(
      <AgentSidebar
        collapsed
        analysisId={4}
        draft=""
        turns={[]}
        actions={[]}
        onToggle={vi.fn()}
        onNewSession={vi.fn()}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
        onRetry={vi.fn()}
        onConfirmAction={vi.fn()}
        onEvidenceSelect={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Evidenz-Copilot öffnen' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Agent-Unterhaltung' })).not.toBeInTheDocument()
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

  it('hides the empty-state and composer while session history is open', () => {
    render(
      <AgentSidebar
        collapsed={false}
        analysisId={4}
        draft=""
        turns={[]}
        actions={[]}
        historyOpen
        savedSessions={[
          {
            session_id: '11111111-1111-4111-8111-111111111111',
            analysis_run_id: 4,
            preview: 'Was steht im Vertrag?',
            turn_count: 2,
            created_at: null,
            updated_at: null,
          },
        ]}
        onToggle={vi.fn()}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
        onRetry={vi.fn()}
        onConfirmAction={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Gespeicherte Sitzungen')).toBeInTheDocument()
    expect(screen.queryByText(/Fragen Sie nach Befunden/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Frage an den Evidenz-Copiloten')).not.toBeInTheDocument()
  })

  it('renames and confirms before deleting a saved session', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    const onDelete = vi.fn()
    render(
      <AgentSidebar
        collapsed={false}
        analysisId={4}
        draft=""
        turns={[]}
        actions={[]}
        historyOpen
        savedSessions={[
          {
            session_id: '11111111-1111-4111-8111-111111111111',
            analysis_run_id: 4,
            preview: 'Alte Sitzung',
            turn_count: 1,
            created_at: null,
            updated_at: null,
          },
        ]}
        onToggle={vi.fn()}
        onRenameSession={onRename}
        onDeleteSession={onDelete}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
        onRetry={vi.fn()}
        onConfirmAction={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Sitzung umbenennen' }))
    await user.clear(screen.getByRole('textbox', { name: 'Sitzung umbenennen' }))
    await user.type(screen.getByRole('textbox', { name: 'Sitzung umbenennen' }), 'Neuer Titel')
    await user.keyboard('{Enter}')
    expect(onRename).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'Neuer Titel')

    await user.click(screen.getByRole('button', { name: 'Sitzung löschen' }))
    expect(onDelete).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Löschen?' }))
    expect(onDelete).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')
  })

  it('labels the paperclip as corpus ingest, not a chat attachment', () => {
    render(
      <AgentSidebar
        collapsed={false}
        analysisId={4}
        draft=""
        turns={[]}
        actions={[]}
        projectId={1}
        onUploadDocument={vi.fn()}
        onToggle={vi.fn()}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
        onRetry={vi.fn()}
        onConfirmAction={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Dokument in den Korpus aufnehmen' })).toBeInTheDocument()
  })

  it('asks for permission in the sidebar instead of a separate queue page', () => {
    const draftAction: ProposedAction = {
      id: 9,
      action_type: 'email',
      status: 'draft',
      payload: { subject: 'SLA-Risiko DE-NRW-0107', composio_tool: 'GMAIL_CREATE_EMAIL_DRAFT' },
      site_ids: ['DE-NRW-0107'],
      evidence_ids: [],
      result: {},
      created_at: null,
    }
    render(
      <AgentSidebar
        collapsed={false}
        analysisId={4}
        draft=""
        turns={[completeTurn]}
        actions={[draftAction]}
        onToggle={vi.fn()}
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
        onRetry={vi.fn()}
        onConfirmAction={vi.fn()}
        onDismissAction={vi.fn()}
      />,
    )
    expect(screen.getByRole('dialog', { name: 'Freigabe erforderlich' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Erlauben' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ablehnen' })).toBeInTheDocument()
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
    act(() =>
      result.current.submitQuestion('Was siehst du?', {
        label: 'FRS-001 · DE-BE-0011',
        page: 'befund',
        findingId: 19,
        kpis: { findings_critical: 3 },
        selectedFinding: {
          id: 19,
          site_id: 'DE-BE-0011',
          rule_id: 'FRS-001',
          severity: 'warning',
          status: 'open',
          message: 'Source record is 51 days old (threshold 30).',
          facts: { age_days: 51 },
          evidence_count: 6,
        },
        visibleFindings: [],
        pendingDraftCount: 0,
      }),
    )
    expect(result.current.question).toBe('')
    expect(result.current.history[0]).toMatchObject({
      analysisRunId: 4,
      question: 'Was siehst du?',
      status: 'pending',
    })
    await waitFor(() => expect(result.current.history[0].status).toBe('complete'))
    const payload = JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body))
    expect(payload.viewport.finding_id).toBe(19)
    expect(payload.viewport.selected_finding.site_id).toBe('DE-BE-0011')

    rerender({ analysisId: 5 })
    expect(result.current.history).toEqual([])
    act(() => result.current.questionChange('Entwurf für Lauf fünf'))
    expect(result.current.question).toBe('Entwurf für Lauf fünf')

    rerender({ analysisId: 4 })
    expect(result.current.history).toHaveLength(1)
    expect(result.current.question).toBe('')
    vi.unstubAllGlobals()
  })

  it('does not invent a session id when creating a session fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, text: async () => 'down' }))
    const { result } = renderHook(() => useAgentAsk(4))
    const existing = result.current.sessionId
    act(() => result.current.startNewSession())
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled())
    expect(result.current.sessionId).toBe(existing)
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

describe('agent viewport from location', () => {
  it('reads the open Inspektor finding from /befund/:id, not from route params', () => {
    expect(findingIdFromLocation('/befund/11', null)).toBe(11)
    expect(findingIdFromLocation('/befund/11/', null)).toBe(11)
    expect(findingIdFromLocation('/', '37')).toBe(37)
    expect(findingIdFromLocation('/', null)).toBeNull()
    expect(pageLabelFromPathname('/befund/11')).toEqual({ page: 'befund', label: 'Inspektor' })
  })

  it('caps Leitstand findings to the compact queue and copies KPIs from the run', () => {
    const findings = Array.from({ length: 20 }, (_, index) => ({
      ...finding,
      id: index + 1,
    }))
    expect(visibleFindingsForPage('/', findings)).toHaveLength(12)
    expect(visibleFindingsForPage('/ausnahmen', findings)).toHaveLength(20)
    expect(pageLabelFromPathname('/aktionen')).toEqual({ page: 'aktionen', label: 'Workbench' })
  })
})
