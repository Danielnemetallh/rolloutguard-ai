import { describe, expect, it } from 'vitest'
import { buildAgentQuestion, pageContextLabel } from '@/lib/pageContext'

describe('pageContextLabel', () => {
  it('maps routes to German labels', () => {
    expect(pageContextLabel('/')).toBe('Leitstand')
    expect(pageContextLabel('/ausnahmen')).toBe('Ausnahmen')
    expect(pageContextLabel('/befund/12', null, 'DE-BE-0003')).toBe('Inspektor · DE-BE-0003')
  })

  it('includes befund on leitstand', () => {
    expect(pageContextLabel('/', '42')).toBe('Leitstand · Befund 42')
  })
})

describe('buildAgentQuestion', () => {
  it('prefixes context once', () => {
    const q = buildAgentQuestion('Wie viele kritisch?', 'Leitstand')
    expect(q).toContain('[Kontext: Leitstand]')
    expect(q).toContain('Wie viele kritisch?')
  })
})
