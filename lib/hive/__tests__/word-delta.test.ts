import { describe, it, expect } from 'vitest'
import { computeWordDelta } from '../word-delta'

describe('computeWordDelta', () => {
  it('first log emits full word count as baseline', () => {
    expect(computeWordDelta(842, 0)).toBe(842)
  })
  it('steady growth = subtract prior sum', () => {
    expect(computeWordDelta(1050, 842)).toBe(208)
  })
  it('deletion = negative delta', () => {
    expect(computeWordDelta(750, 842)).toBe(-92)
  })
  it('no change = 0', () => {
    expect(computeWordDelta(842, 842)).toBe(0)
  })
  it('guards against NaN currentWordCount', () => {
    expect(computeWordDelta(NaN as unknown as number, 100)).toBe(0)
  })
  it('treats NaN priorSum as 0', () => {
    expect(computeWordDelta(500, NaN as unknown as number)).toBe(500)
  })
  it('negative currentWordCount is treated as 0', () => {
    expect(computeWordDelta(-10, 0)).toBe(0)
  })
})
