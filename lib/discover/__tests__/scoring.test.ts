import { describe, it, expect } from 'vitest'
import { computeTrendingScore, computeRisingStarsScore } from '../scoring'

describe('computeTrendingScore', () => {
  it('weights comments x2, follows x3, likes + reads x1', () => {
    expect(computeTrendingScore({ likes7d: 10, comments7d: 5, reads7d: 20, follows7d: 2 }))
      .toBe(10 + 5 * 2 + 20 + 2 * 3) // 46
  })
  it('zero inputs → 0', () => {
    expect(computeTrendingScore({ likes7d: 0, comments7d: 0, reads7d: 0, follows7d: 0 })).toBe(0)
  })
})

describe('computeRisingStarsScore', () => {
  it('divides by (totalLikesAllTime + 1) so unknown books score higher per unit velocity', () => {
    const a = computeRisingStarsScore({ likes7d: 100, comments7d: 0, reads7d: 0, follows7d: 0, totalLikesAllTime: 100, ageDays: 10 })
    const b = computeRisingStarsScore({ likes7d: 100, comments7d: 0, reads7d: 0, follows7d: 0, totalLikesAllTime: 10, ageDays: 10 })
    expect(b).toBeGreaterThan(a)
  })
  it('demotes books older than 180 days by 0.5x', () => {
    const young = computeRisingStarsScore({ likes7d: 100, comments7d: 0, reads7d: 0, follows7d: 0, totalLikesAllTime: 0, ageDays: 30 })
    const old = computeRisingStarsScore({ likes7d: 100, comments7d: 0, reads7d: 0, follows7d: 0, totalLikesAllTime: 0, ageDays: 200 })
    expect(old).toBeCloseTo(young * 0.5)
  })
  it('handles totalLikesAllTime=0 without divide-by-zero', () => {
    expect(computeRisingStarsScore({ likes7d: 5, comments7d: 0, reads7d: 0, follows7d: 0, totalLikesAllTime: 0, ageDays: 10 })).toBe(5)
  })
})
