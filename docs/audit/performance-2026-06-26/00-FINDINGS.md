# Issue #37 — Performance Audit Findings (measure-first)

**Date:** 2026-06-26 · **Branch:** main · **Status:** AUDIT COMPLETE, awaiting steer on scope before implementation.

This is the audit deliverable for #37. Nothing below has been implemented yet. The four dimensions (caching, DB/indexes, route caching, bundle) were each swept; results are ranked by impact/effort so Chris can pick what to tackle.

---

## TL;DR — what's actually worth doing

| # | Change | Impact | Effort | Risk | Verdict |
|---|--------|--------|--------|------|---------|
| 1 | Add 3-4 missing DB indexes (`book_likes(book_id)`, `follows(followee_id)`, `bookmarks(book_id)`, maybe `reading_lists(genre)`) via idempotent migrate script | HIGH | LOW | ~zero (additive) | **Safe win** |
| 2 | `lib/cache.ts` Upstash `cachedAction(key, fn, ttl)` wrapper (graceful no-op when Upstash unset, mirrors `lib/rate-limit.ts`) | infra | LOW | ~zero | **Safe win (enables 3+4)** |
| 3 | Wrap community dashboard aggregator in Upstash short-TTL cache (per-viewer, 30-60s) | HIGH | MED | LOW (slight feed staleness, acceptable) | **Recommend** |
| 4 | Wrap discover trending/popular + profile-stats aggregators in Upstash short-TTL | MED-HIGH | MED | LOW | **Recommend** |
| 5 | Add `react cache()` to per-request-duplicated helpers (`getBlocked*ForViewer`, `getViewerTopGenres` already done) | MED | LOW | ~zero | **Recommend** |
| 6 | Add explicit `dynamic = 'force-dynamic'` clarity markers to session-reading public routes | LOW | LOW | zero | Optional (clarity only, no perf) |
| 7 | Bundle: lazy-load nothing — already correct. Optional `@next/bundle-analyzer` for monitoring | n/a | LOW | zero | **Skip / optional** |

**Recommended batch:** 1 + 2 + 3 + 4 + 5. These are additive, behavior-preserving, and measurable. Items 6-7 are cosmetic/monitoring.

---

## 1. DB indexes — the single highest-value finding

Most composite-PK tables are fine: a PK on `(a, b)` already serves `WHERE a = ?`. The gaps are queries that filter/group on the **trailing** column alone, which the PK index can't serve.

**Genuinely missing (hot paths):**

| Index to add | Why | Hot call sites |
|---|---|---|
| `book_likes(book_id)` | PK is `(user_id, book_id)`; every trending/ranking path counts likes **per book** (`WHERE book_id IN (...) GROUP BY book_id` and correlated `WHERE book_id = books.id`). Currently a scan. | `discover-shared.ts:239/328/453`, `discover.actions.ts:589/840`, `discover-for-you-books.actions.ts:86`, `community-dashboard.helpers.ts:68/439` |
| `follows(followee_id)` | PK is `(follower_id, followee_id)`; "who follows X" / follower-count / notification fan-out filter on `followee_id` alone. | `discover.actions.ts:863` (follower counts per author for ranking), `community-dashboard.helpers.ts:373`, `chapter.actions.ts:238` (new-chapter notify), `blocks.actions.ts:48` |
| `bookmarks(book_id)` | PK `(user_id, book_id)`; bookmark-count-per-book aggregation unindexed. Lower traffic than likes. | discover ranking signal subqueries |
| `reading_lists(genre)` | D3a genre filter on discover lists; `genre` text column has no btree (only `tags` GIN exists). | `discover-lists.actions.ts` genre filter branch |

**NOT missing (audit sub-agent flagged these in error — they're leading PK columns, already covered):**
`follows(follower_id)`, `userMutes(muter_id)`, `bookLikes(user_id)`, `bookmarks(user_id)`, `readingProgress(user_id)`.

**How:** one idempotent `scripts/migrate-perf-indexes.ts` using `CREATE INDEX IF NOT EXISTS` (matches `migrate-list-tags-gin.ts` pattern). Add matching `index()` defs to `db/schema/social.ts` so schema stays the source of truth. **Measure:** `EXPLAIN ANALYZE` before/after on the likes-per-book aggregate.

## 2. N+1 / pagination

- **No true N+1 found.** The scoring loops in discover-{clubs,hives,lists} are CPU-only over pre-batched `Promise.all` results — safe.
- **OFFSET pagination:** 13 sites. Only `discover-for-you-books.actions.ts:109` is a genuinely hot surface; the rest are user-initiated search/detail pages with bounded depth. Cursor migration of For You is **deferred** (medium effort, the aggregator is the bigger win) unless Chris wants it.

## 3. Caching gaps

**Already good:** 15 `unstable_cache` sites (trending rails 5m, genre/tag counts 5m, platform/viewer top genres 1h) + 9 `react cache()` sites (membership, friendship, block checks, word-goal summary).

**The big uncached aggregator — community dashboard.** `buildDashboardData(viewerId)` (community-dashboard.actions.ts:27) is wrapped in `react cache()` (per-request only) but runs **8 parallel sub-aggregators / ~20 queries** on every dashboard load, per viewer, with zero cross-request cache. This is the heaviest single page in the app. → Upstash per-viewer short TTL (30-60s); it's a feed/overview, slight staleness is fine, no explicit invalidation needed at that TTL.

**Other Upstash candidates (short TTL, read-only aggregates):**
- `getPublicProfileAction` — 6 parallel stat counts per profile view → 60-300s per username.
- For-You discover aggregators (`getForYou{Sparks,Hives,Lists,Clubs}Action`) — 3-tier multi-query; `getViewerTopGenres` already cached 1h but tier candidates + `getBlocked*ForViewer` run fresh.

**`react cache()` quick wins (per-request dedup, ~zero risk):** `getBlockedSparkCreatorIds` / `getBlocked*OwnerIdsForViewer` are called multiple times within a single discover render.

**Do NOT cache (correctly real-time):** editor saves, notifications, like/bookmark toggles, friends-desk cursor feed.

## 4. Route caching

- `/pricing` already ISR `revalidate=3600` (correct). Admin + webhook + export routes correctly `force-dynamic`/`nodejs`.
- Public session-reading routes (`books/[bookId]`, `u/[username]`, landing) are correctly dynamic but lack explicit `dynamic` markers — **clarity only, no perf change.** Low priority.
- `/discover` can't trivially ISR (searchParams-driven). The aggregator-caching in §3 is the better lever here.

## 5. Bundle

**Clean.** `serverExternalPackages: ['pdfkit','fontkit','mammoth','pdfjs-dist']` correctly keeps heavy parsers server-side; export/import modals call server actions (no heavy static imports in client bundle); TipTap + dnd-kit load only on editor/management pages, not public. No server-component-importing-client-lib violations. Optional: add `@next/bundle-analyzer` for ongoing monitoring. **No action needed for #37 acceptance.**

---

## Proposed implementation order (pending Chris's pick)

1. `scripts/migrate-perf-indexes.ts` + `db/schema/social.ts` index defs — run, `EXPLAIN ANALYZE` before/after.
2. `lib/cache.ts` — `cachedAction(key, fn, ttlSeconds)` + `invalidateCache(key)`, Upstash-or-noop.
3. Wire dashboard + profile-stats + ≥1 discover trending aggregator through `cachedAction` (≥3 to satisfy AC).
4. `react cache()` on the blocked-ids helpers.
5. tsc + full test suite, sanity-check no stale data after writes.

Acceptance-criteria coverage: audit doc ✅(this) · `lib/cache.ts` ✅(step 2) · ≥3 aggregators cached ✅(step 3) · missing indexes ✅(step 1) · bundle no-regress ✅(untouched) · tests+tsc ✅(step 5).

---

## Documented follow-up (deliberately NOT done in this pass)

**Discover book-grid caching.** `getTrendingBooksAction` / `getPopularBooksAction` / `searchBooksDiscoverAction` are left uncached for two reasons: (1) `BookCard.lastUpdatedAt` is a `Date`, so caching the raw payload through Upstash JSON would coerce it to a string on a cache hit — a silent regression for any card consumer calling Date methods; (2) the grid is keyed by genre × sort × page × filters, so caching every combo has a near-zero hit rate. The discover *rails* + genre/tag facet counts are already `unstable_cache`'d (5min), so the surface is already substantially cached.

**When/if to do it:** once there's real traffic to measure against (the dev DB is currently empty — the win is unmeasurable today). Scope it to the **high-traffic default variants only** (trending/popular, default sort, page 1, per-genre ≈15 keys), and cache a **serializable DTO** — store `lastUpdatedAt` as epoch-ms, rehydrate to `Date` on read — so the `BookCard` contract to the components stays byte-identical. TTL ~120s. This keeps the win where the hit rate is high without the Date-contract risk.

**Not worth doing** (correctness/complexity > speed): moving like/view/read counts to Redis `INCR` (these are the real-time values #37 says NOT to cache), or a `ZSET` trending leaderboard (a whole subsystem for marginal gain at current scale).
