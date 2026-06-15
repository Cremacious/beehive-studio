import { describe, it, expect } from 'vitest'
import { truncateAtWord } from '../truncate-at-word'

describe('truncateAtWord', () => {
  it('returns original when shorter than maxLen', () => {
    expect(truncateAtWord('short', 80)).toBe('short')
  })
  it('returns original when exactly maxLen', () => {
    expect(truncateAtWord('a'.repeat(80), 80)).toBe('a'.repeat(80))
  })
  it('truncates at last space before maxLen', () => {
    const input = 'A heist gone right in a kingdom that does not exist and is long'
    const r = truncateAtWord(input, 30)
    expect(r.endsWith('…')).toBe(true)
    expect(r.length).toBeLessThanOrEqual(31)
    expect(r).not.toContain('  ')
  })
  it('falls back to hard slice when no whitespace exists', () => {
    expect(truncateAtWord('a'.repeat(100), 10)).toBe('a'.repeat(10) + '…')
  })
  it('trims trailing whitespace before the ellipsis', () => {
    expect(truncateAtWord('hello world  more text', 7)).toBe('hello…')
  })
})
