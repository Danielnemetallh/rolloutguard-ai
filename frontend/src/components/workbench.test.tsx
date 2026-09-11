import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AgentSidebar } from '@/components/AgentSidebar'
import { CitationList } from '@/components/CitationList'
import { SideNav } from '@/components/SideNav'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { AgentTurn } from '@/types'

function renderWithRouter(ui: ReactElement, route = '/') {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </TooltipProvider>,
  )
}

describe('SideNav', () => {
  it('keeps accessible route names when navigation is collapsed', () => {
    renderWithRouter(<SideNav collapsed onToggle={vi.fn()} />, '/ausnahmen')
    expect(screen.getByRole('link', { name: 'Ausnahmen' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Navigation ausklappen' })).toBeInTheDocument()
  })

  it('exposes logo collapse control when expanded', () => {
    renderWithRouter(<SideNav collapsed={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Navigation einklappen' })).toBeInTheDocument()
  })
})

describe('AgentSidebar', () => {
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

  it('renders user bubble and frameless agent answer', () => {
    render(
      <AgentSidebar
        onClose={vi.fn()}
        analysisId={4}
        question=""
        pending={false}
        history={[completeTurn]}
        sessions={[]}
        activeSessionTitle="Neuer Chat"
        pageContextLabel="Leitstand"
        actions={[]}
        confirmPending={false}
        dismissPending={false}
        integrations={undefined}
        onQuestionChange={vi.fn()}
        onSubmit={vi.fn()}
        onRetry={vi.fn()}
        onNewChat={vi.fn()}
        onSelectSession={vi.fn()}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        onConnect={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Ihre Nachricht')).toHaveTextContent('Welche Quelle belegt das?')
    expect(screen.getByLabelText('Agent-Antwort')).toHaveTextContent('Der Termin stammt aus dem Vertrag.')
  })
})

describe('CitationList', () => {
  it('renders accordion sources', () => {
    render(
      <CitationList
        citations={[
          {
            id: 'c1',
            sourceKind: 'workbook_cell',
            label: 'Vertrag',
            locator: 'Sheet A, Zeile 12',
            snippet: 'Fälligkeit 15.09.',
            evidenceId: null,
            documentId: null,
          },
        ]}
      />,
    )
    expect(screen.getByText('Quellen (1)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vertrag/ })).toBeInTheDocument()
  })
})
