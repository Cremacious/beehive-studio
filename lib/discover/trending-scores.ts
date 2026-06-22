/**
 * Issue #32 — pure per-entity trending + popular score helpers.
 *
 * Trending: 7-day windowed signal sums weighted per TRENDING_WEIGHTS.
 * Popular: cumulative totals weighted per POPULAR_WEIGHTS.
 *
 * Hives + Clubs re-export existing platform activity helpers from
 * hive-activity-score.ts and club-activity-score.ts (issue #32 keeps the
 * pre-existing weighting; do not introduce a parallel computation).
 *
 * These helpers are pure: no DB access. Callers project their candidate
 * rows + signal counts, then map through these scorers.
 */

import { TRENDING_WEIGHTS, POPULAR_WEIGHTS } from './ranking-weights'

// ─── Books ────────────────────────────────────────────────────────────────────

export type BookTrendingInputs = {
  newLikes7d: number
  newChapterReads7d: number
  newBookmarks7d: number
  newFollowsOfAuthor7d: number
}

export function computeBookTrendingScore(i: BookTrendingInputs): number {
  const w = TRENDING_WEIGHTS.books
  return (
    i.newLikes7d * w.newLikes +
    i.newChapterReads7d * w.newChapterReads +
    i.newBookmarks7d * w.newBookmarks +
    i.newFollowsOfAuthor7d * w.newFollowsOfAuthor
  )
}

export type BookPopularInputs = {
  totalLikes: number
  totalChapterReads: number
  totalBookmarks: number
}

export function computeBookPopularScore(i: BookPopularInputs): number {
  const w = POPULAR_WEIGHTS.books
  return (
    i.totalLikes * w.totalLikes +
    i.totalChapterReads * w.totalChapterReads +
    i.totalBookmarks * w.totalBookmarks
  )
}

// ─── Sparks ───────────────────────────────────────────────────────────────────

export type SparkTrendingInputs = {
  newEntries7d: number
  newVotes7d: number
  newLikes7d: number
}

export function computeSparkTrendingScore(i: SparkTrendingInputs): number {
  const w = TRENDING_WEIGHTS.sparks
  return (
    i.newEntries7d * w.newEntries +
    i.newVotes7d * w.newVotes +
    i.newLikes7d * w.newLikes
  )
}

export type SparkPopularInputs = {
  totalEntries: number
  totalVotes: number
  totalLikes: number
}

export function computeSparkPopularScore(i: SparkPopularInputs): number {
  const w = POPULAR_WEIGHTS.sparks
  return (
    i.totalEntries * w.totalEntries +
    i.totalVotes * w.totalVotes +
    i.totalLikes * w.totalLikes
  )
}

// ─── Hives ────────────────────────────────────────────────────────────────────
// Trending: re-export the existing platform helper.

export {
  computeHiveActivityScore7d,
  type HiveActivityInputs,
} from './hive-activity-score'

// Popular: hives are ordered by `member_count` desc with `last_activity_at` desc
// as tiebreaker. No computed score — pure DB ORDER BY at the action layer.
// This helper exists only so callers have a consistent "popular score" surface
// for testing/observability: it returns member_count directly.
export type HivePopularInputs = {
  memberCount: number
}

export function computeHivePopularScore(i: HivePopularInputs): number {
  return i.memberCount
}

// ─── Lists ────────────────────────────────────────────────────────────────────

export type ListTrendingInputs = {
  newFollowers7d: number
  newBooksAdded7d: number
}

export function computeListTrendingScore(i: ListTrendingInputs): number {
  const w = TRENDING_WEIGHTS.lists
  return i.newFollowers7d * w.newFollowers + i.newBooksAdded7d * w.newBooksAdded
}

export type ListPopularInputs = {
  followerCount: number
}

export function computeListPopularScore(i: ListPopularInputs): number {
  return i.followerCount
}

// ─── Clubs ────────────────────────────────────────────────────────────────────
// Trending: re-export the existing platform helper.

export {
  computeClubActivityScore7d,
  type ClubActivityInputs,
} from './club-activity-score'

// Popular: ordered by `member_count` desc with `last_activity_at` desc tiebreak.
export type ClubPopularInputs = {
  memberCount: number
}

export function computeClubPopularScore(i: ClubPopularInputs): number {
  return i.memberCount
}
