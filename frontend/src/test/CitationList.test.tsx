import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CitationList } from '@/components/CitationList'
import type { AgentCitation } from '@/types'

function renderCitations(citations: AgentCitation[]) {
  return render(
    <BrowserRouter>
      <CitationList citations={citations} />
    </BrowserRouter>,
  )
}

const sample = [

  {
    id: 'E-1',
    source_kind: 'workbook_cell' as const,
    label: 'contract.xlsx',
    locator: 'Sheet A · r2',
    snippet: 'Wert 42',
    evidence_id: 'E-1',
    document_id: null,
  },
  {
    id: 'doc:1#c0',
    source_kind: 'document_chunk' as const,
    label: 'memo.pdf',
    locator: 'Abschnitt 1',
    snippet: 'Auszug',
    evidence_id: null,
    document_id: 1,
  },
]

describe('CitationList', () => {
  it('shows fallback when empty', () => {
    renderCitations([])
    expect(screen.getByText(/Keine überprüfbare Quelle/)).toBeInTheDocument()
  })

  it('expands one citation at a time', async () => {
    const user = userEvent.setup()
    renderCitations(sample)
    const triggers = screen.getAllByRole('button')
    await user.click(triggers[0])
    expect(screen.getByText('Wert 42')).toBeInTheDocument()
    await user.click(triggers[1])
    expect(screen.queryByText('Wert 42')).not.toBeInTheDocument()
    expect(screen.getByText('Auszug')).toBeInTheDocument()
  })
})
