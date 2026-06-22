/**
 * Issue #32 — formal trending/popular weights.
 *
 * Single source of truth for ranking algorithm coefficients across the 5
 * discover entities. Trending = 7-day windowed signals; Popular = totals.
 */

export const TRENDING_WEIGHTS = {
  books: {
    newLikes: 4,
    newChapterReads: 3,
    newBookmarks: 2,
    newFollowsOfAuthor: 1,
  },
  sparks: {
    newEntries: 5,
    newVotes: 3,
    newLikes: 2,
  },
  // Hives + clubs reuse pre-existing platform helpers
  // (computeHiveActivityScore7d, computeClubActivityScore7d).
  lists: {
    newFollowers: 5,
    newBooksAdded: 2,
  },
} as const

export const POPULAR_WEIGHTS = {
  books: {
    totalLikes: 3,
    totalChapterReads: 2,
    totalBookmarks: 1,
  },
  sparks: {
    totalEntries: 4,
    totalVotes: 2,
    totalLikes: 1,
  },
  // Hives + Lists + Clubs: ordered by denorm columns
  // (member_count, follower_count, member_count respectively) with
  // last_activity_at / last_updated_at as tiebreaker.
} as const
