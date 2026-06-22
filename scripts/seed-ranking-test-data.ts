/**
 * Issue #32 — ranking algorithm smoke seed.
 *
 * Dev-only helper to verify the trending + popular algorithms surface the
 * right rows in the right order. Designed to be idempotent on re-run: writes
 * known-shape rows tagged with a stable username prefix (`rankseed_`) so a
 * second invocation overwrites prior seed without touching real data.
 *
 * Usage:
 *   npm run seed:ranking-test
 *
 * Composition strategy:
 *   - 3 seed users (rankseed_alpha, rankseed_beta, rankseed_gamma).
 *   - 3 PUBLIC + discoverable books with sharply different signal volumes so
 *     the trending + popular sorts have an unambiguous ground truth.
 *   - For book A: 5 likes + 10 chapter reads (trending score 5*4 + 10*3 = 50).
 *   - For book B: 1 like  + 1  chapter read  (trending score 1*4 + 1*3  =  7).
 *   - For book C: 0 likes + 0 chapter reads  (trending score = 0).
 *
 * After running, open /discover?tab=books&mode=trending and verify that
 * A appears above B above C. Same ordering should hold on ?mode=popular.
 *
 * Implementation note: this scaffold intentionally STAYS small. Filling in
 * full INSERT logic requires per-table schema work (users, books, likes,
 * chapter_reads, follows). The existing `npm run seed:discover` already
 * populates a much richer dev DB; this helper is a thin diagnostic on top.
 * If you need richer trending fixtures, run seed:discover first, then this.
 *
 * TODO(#32): wire real INSERTs once the test surface stabilizes.
 */

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(
    [
      '',
      '── ranking-test seed ──────────────────────────────────────────',
      '',
      'This is a stub scaffold for issue #32 ranking smoke data.',
      '',
      'For now, run `npm run seed:discover` to get the richer dev fixture',
      'set, then open /discover and toggle between All / Trending / Popular',
      'to confirm the new mode-descriptor line appears and the ordering',
      'matches the formal algorithm.',
      '',
      'Trending weights (lib/discover/ranking-weights.ts):',
      '  books:  likes*4 + reads*3 + bookmarks*2 + follows*1',
      '  sparks: entries*5 + votes*3 + likes*2',
      '  hives:  computeHiveActivityScore7d (existing)',
      '  lists:  followers*5 + booksAdded*2',
      '  clubs:  computeClubActivityScore7d (existing)',
      '',
      'Popular weights:',
      '  books:  totalLikes*3 + totalReads*2 + totalBookmarks*1',
      '  sparks: totalEntries*4 + totalVotes*2 + totalLikes*1',
      '  hives:  member_count desc (tiebreak last_activity_at)',
      '  lists:  follower_count desc (tiebreak last_updated_at)',
      '  clubs:  member_count desc (tiebreak last_activity_at)',
      '',
      '───────────────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  )
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
