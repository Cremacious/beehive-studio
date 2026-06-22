import { describe, it, expect } from 'vitest'
import { computeTrendingScore, computeRisingStarsScore } from '../scoring'

describe('computeTrendingScore (issue #32 time-decay)', () => {
  it('weights likes x3, comments x2, bookmarks x1, divides by (hoursAgo+2)^1.5', () => {
    // engagement = 10*3 + 5*2 + 2 = 42
    // ageDecay = (10+2)^1.5 = 12^1.5 ≈ 41.5692...
    const score = computeTrendingScore({
      likeCount: 10,
      commentCount: 5,
      bookmarkCount: 2,
      hoursAgo: 10,
    })
    expect(score).toBeCloseTo(42 / Math.pow(12, 1.5), 6)
  })

  it('zero engagement → 0', () => {
    expect(
      computeTrendingScore({
        likeCount: 0,
        commentCount: 0,
        bookmarkCount: 0,
        hoursAgo: 5,
      }),
    ).toBe(0)
  })

  it('newer item scores higher than older item for same engagement', () => {
    const fresh = computeTrendingScore({
      likeCount: 10,
      commentCount: 0,
      bookmarkCount: 0,
      hoursAgo: 1,
    })
    const stale = computeTrendingScore({
      likeCount: 10,
      commentCount: 0,
      bookmarkCount: 0,
      hoursAgo: 100,
    })
    expect(fresh).toBeGreaterThan(stale)
  })

  it('avoids divide-by-zero at hoursAgo=0 (denominator floored at 2^1.5)', () => {
    const score = computeTrendingScore({
      likeCount: 1,
      commentCount: 0,
      bookmarkCount: 0,
      hoursAgo: 0,
    })
    // engagement = 1*3 = 3, ageDecay = (0+2)^1.5 = 2^1.5
    expect(score).toBeCloseTo(3 / Math.pow(2, 1.5), 6)
    expect(Number.isFinite(score)).toBe(true)
  })
})

describe('computeRisingStarsScore', () => {
  it('divides by (totalLikesAllTime + 1) so unknown books score higher per unit velocity', () => {
    const a = computeRisingStarsScore({
      likeCount: 100,
      commentCount: 0,
      bookmarkCount: 0,
      hoursAgo: 240,
      totalLikesAllTime: 100,
      ageDays: 10,
    })
    const b = computeRisingStarsScore({
      likeCount: 100,
      commentCount: 0,
      bookmarkCount: 0,
      hoursAgo: 240,
      totalLikesAllTime: 10,
      ageDays: 10,
    })
    expect(b).toBeGreaterThan(a)
  })

  it('demotes books older than 180 days by 0.5x', () => {
    const young = computeRisingStarsScore({
      likeCount: 100,
      commentCount: 0,
      bookmarkCount: 0,
      hoursAgo: 720,
      totalLikesAllTime: 0,
      ageDays: 30,
    })
    const old = computeRisingStarsScore({
      likeCount: 100,
      commentCount: 0,
      bookmarkCount: 0,
      hoursAgo: 720,
      totalLikesAllTime: 0,
      ageDays: 200,
    })
    expect(old).toBeCloseTo(young * 0.5, 6)
  })

  it('handles totalLikesAllTime=0 without divide-by-zero', () => {
    const score = computeRisingStarsScore({
      likeCount: 5,
      commentCount: 0,
      bookmarkCount: 0,
      hoursAgo: 240,
      totalLikesAllTime: 0,
      ageDays: 10,
    })
    expect(Number.isFinite(score)).toBe(true)
    expect(score).toBeGreaterThan(0)
  })
})
