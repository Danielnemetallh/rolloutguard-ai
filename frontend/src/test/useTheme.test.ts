import { describe, expect, it, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('theme storage key', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to dark when unset', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../hooks/useTheme.ts'),
      'utf8',
    )
    expect(source).toContain("rolloutguard.theme")
    expect(localStorage.getItem('rolloutguard.theme')).toBeNull()
  })
})
