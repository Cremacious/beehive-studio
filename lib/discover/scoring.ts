/**
 * Issue #32 — time-decayed trending score.
 *
 * Engagement (likes * 3 + comments * 2 + bookmarks) divided by (hoursAgo + 2)^1.5.
 *
 * Cumulative all-time counts (NOT 7d-windowed) are intentional: time-decay in
 * the denominator already prioritizes recent items; cumulative counts mean an
 * older item with strong engagement can resurface if it's still meaningful.
 *
 * Per-entity callers that lack a particular signal pass 0 for that field.
 * For example sparks have no likes/comments/bookmarks — they pass entryCount
 * via `likeCount` (the primary engagement signal slot).
 */

export type TrendingInputs = {
  /** Cumulative all-time likes (or primary engagement signal for the entity). */
  likeCount: number
  /** Cumulative all-time comments (or secondary engagement signal). */
  commentCount: number
  /** Cumulative all-time bookmarks (or 0 if entity has no bookmarks). */
  bookmarkCount: number
  /** Hours since the item became publicly discoverable (or was created). */
  hoursAgo: number
}

export function computeTrendingScore(i: TrendingInputs): number {
  const engagement = i.likeCount * 3 + i.commentCount * 2 + i.bookmarkCount
  const ageDecay = Math.pow(i.hoursAgo + 2, 1.5)
  return engagement / ageDecay
}

/**
 * Rising-stars variant: rewards per-unit-velocity (engagement per all-time-like).
 * Demotes books older than 180 days by 0.5x.
 *
 * Kept for `getRisingStarsBooksAction` which still uses the old velocity model.
 * Inputs map directly onto the new cumulative shape — `likeCount` is the primary
 * engagement (likes), `commentCount` + `bookmarkCount` round out the engagement,
 * `totalLikesAllTime` is the denominator, `ageDays` is the demotion gate.
 */
export type RisingStarsInputs = TrendingInputs & {
  totalLikesAllTime: number
  ageDays: number
}

export function computeRisingStarsScore(i: RisingStarsInputs): number {
  const trending = computeTrendingScore(i)
  const denom = i.totalLikesAllTime + 1
  const base = trending / denom
  return i.ageDays > 180 ? base * 0.5 : base
}
