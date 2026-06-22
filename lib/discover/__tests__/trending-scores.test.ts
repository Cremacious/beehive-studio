import { describe, it, expect } from 'vitest'
import {
  computeBookTrendingScore,
  computeBookPopularScore,
  computeSparkTrendingScore,
  computeSparkPopularScore,
  computeListTrendingScore,
  computeListPopularScore,
  computeHivePopularScore,
  computeClubPopularScore,
} from '../trending-scores'

describe('Books — trending', () => {
  it('weights newLikes*4 + newChapterReads*3 + newBookmarks*2 + newFollowsOfAuthor*1', () => {
    expect(
      computeBookTrendingScore({
        newLikes7d: 1,
        newChapterReads7d: 1,
        newBookmarks7d: 1,
        newFollowsOfAuthor7d: 1,
      }),
    ).toBe(4 + 3 + 2 + 1)
  })

  it('returns 0 when all signals are 0', () => {
    expect(
      computeBookTrendingScore({
        newLikes7d: 0,
        newChapterReads7d: 0,
        newBookmarks7d: 0,
        newFollowsOfAuthor7d: 0,
      }),
    ).toBe(0)
  })

  // Canonical "likes outweigh reads-at-low-volume" check.
  // NOTE: the issue spec wording was "100 likes scores higher than
  // 50 likes + 200 reads" which is arithmetically false with weights
  // newLikes=4, newReads=3 (100*4=400 vs 50*4 + 200*3 = 200+600=800).
  // Substituted a comparison that is true with the spec's weights and
  // captures the same intent (single high-weight signal beats a mixed
  // low-volume signal pair).
  it('book with 100 likes scores higher than 50 likes + 10 reads', () => {
    const a = computeBookTrendingScore({
      newLikes7d: 100,
      newChapterReads7d: 0,
      newBookmarks7d: 0,
      newFollowsOfAuthor7d: 0,
    })
    const b = computeBookTrendingScore({
      newLikes7d: 50,
      newChapterReads7d: 10,
      newBookmarks7d: 0,
      newFollowsOfAuthor7d: 0,
    })
    expect(a).toBe(400)
    expect(b).toBe(230)
    expect(a).toBeGreaterThan(b)
  })
})

describe('Books — popular', () => {
  it('weights totalLikes*3 + totalChapterReads*2 + totalBookmarks*1', () => {
    expect(
      computeBookPopularScore({
        totalLikes: 1,
        totalChapterReads: 1,
        totalBookmarks: 1,
      }),
    ).toBe(3 + 2 + 1)
  })
})

describe('Sparks — trending', () => {
  it('weights newEntries*5 + newVotes*3 + newLikes*2', () => {
    expect(
      computeSparkTrendingScore({
        newEntries7d: 1,
        newVotes7d: 1,
        newLikes7d: 1,
      }),
    ).toBe(5 + 3 + 2)
  })
})

describe('Sparks — popular', () => {
  it('weights totalEntries*4 + totalVotes*2 + totalLikes*1', () => {
    expect(
      computeSparkPopularScore({
        totalEntries: 1,
        totalVotes: 1,
        totalLikes: 1,
      }),
    ).toBe(4 + 2 + 1)
  })
})

describe('Lists — trending', () => {
  it('weights newFollowers*5 + newBooksAdded*2', () => {
    expect(
      computeListTrendingScore({
        newFollowers7d: 1,
        newBooksAdded7d: 1,
      }),
    ).toBe(5 + 2)
  })
})

describe('Lists — popular', () => {
  it('returns followerCount directly', () => {
    expect(computeListPopularScore({ followerCount: 42 })).toBe(42)
  })
})

describe('Hives + Clubs — popular', () => {
  it('hive popular score is memberCount', () => {
    expect(computeHivePopularScore({ memberCount: 17 })).toBe(17)
  })

  it('club popular score is memberCount', () => {
    expect(computeClubPopularScore({ memberCount: 8 })).toBe(8)
  })
})
