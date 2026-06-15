import { describe, it, expect } from 'vitest'
import { synthesizeTitle } from '../synthesize-title'

describe('synthesizeTitle', () => {
  it('takes first 4 words and title-cases them', () => {
    expect(synthesizeTitle('a heist gone right in a kingdom')).toBe('A Heist Gone Right')
  })
  it('strips trailing punctuation', () => {
    expect(synthesizeTitle('an object that grants wishes!')).toBe('An Object That Grants')
  })
  it('handles fewer than 4 words', () => {
    expect(synthesizeTitle('two strangers meet')).toBe('Two Strangers Meet')
  })
  it('falls back to Untitled Spark for empty input', () => {
    expect(synthesizeTitle('')).toBe('Untitled Spark')
    expect(synthesizeTitle('   ')).toBe('Untitled Spark')
  })
  it('caps at 50 chars with ellipsis when very long words', () => {
    const r = synthesizeTitle('antidisestablishmentarianism is a long word indeed')
    expect(r.length).toBeLessThanOrEqual(50)
  })
  it('is deterministic (same input → same output)', () => {
    const r1 = synthesizeTitle('test prompt here please')
    const r2 = synthesizeTitle('test prompt here please')
    expect(r1).toBe(r2)
  })
})
