# Hot Books Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Hot Books discovery surface per the locked spec at [docs/superpowers/specs/2026-06-15-hot-books-discovery-design.md](../specs/2026-06-15-hot-books-discovery-design.md) ([dd23b8c](https://github.com/Cremacious/beehive-studio/commit/dd23b8c)). Replace the slim Featured strip on `/discover?tab=books` with an iOS segmented mode toggle (For You / Trending / Popular / All), narrow the sort dropdown to Most recent + A-Z, and wire the 3-tier hybrid For You algorithm.

**Architecture:** New action file `lib/actions/discover-for-you-books.actions.ts` houses the new actions to keep the already-large `discover.actions.ts` from growing. Pure helpers (taste vector, default-mode resolver, mode parser) live under `lib/discover/` and ship with unit tests. `<BooksGrid>` becomes a thin dispatcher that picks the right action per mode. No schema changes — all signals computed at query time from existing tables.

**Reference precedent:** D-phase polish round 4 ([641eca7](https://github.com/Cremacious/beehive-studio/commit/641eca7)) for cursor/page input shape patterns. W2.1 Books search extension ([775ff9d](https://github.com/Cremacious/beehive-studio/commit/775ff9d)) for the filter shape additive extension pattern. URL state helper ([9ce1c10](https://github.com/Cremacious/beehive-studio/commit/9ce1c10)) is the parser model.

**Resolved deferred decisions (from spec Resume Here):**
1. **`getTrendingBooksAction` reuse vs wrap** — extend in-place with the same `{page?, filters?}` input shape used by `searchBooksDiscoverAction` so it's a drop-in. The existing input contract gets widened (additive, no breakage); the existing call sites pass through.
2. **Mode dispatch shape in `<BooksGrid>`** — small switch statement inside the server component; each branch returns `{ books, totalCount }` so the renderer is identical post-dispatch. Extract `dispatchMode()` helper if the switch grows past 4 entries.
3. **`chapter_reads` join cost** — Tier 1 already has the right index (`chapter_reads_user_book_idx` per H4 schema). Plan ships as-is; manual smoke verifies p95 at seed-data scale; defer denorm to follow-up if it bites.

**Pattern carry-forward:**
- New `parseMode()` helper goes in `lib/discover/url-state.ts` (mirrors `parseTab`).
- Public-discoverable filter helpers (`buildPublicBookFilters`) reused across all 3 tiers.
- `projectToBookCards` is the canonical projection — all new actions feed it.

---

## File structure

**New:**
- `lib/discover/resolve-default-mode.ts` + `__tests__/resolve-default-mode.test.ts`
- `lib/discover/taste-vector.ts` + `__tests__/taste-vector.test.ts`
- `lib/actions/discover-for-you-books.actions.ts` (houses `getForYouBooksAction` + `getPopularBooksAction` + `hasAnyDiscoverySignalAction`)
- `lib/actions/__tests__/discover-for-you-books-actions.test.ts`
- `app/[locale]/(public)/discover/_components/discovery-mode-toggle.tsx`

**Modified:**
- `lib/discover/url-state.ts` — append `parseMode` helper + `MODE_IDS` constant.
- `lib/discover/url-state.test.ts` — add `parseMode` cases.
- `lib/actions/discover.actions.ts` — extend `getTrendingBooksAction` signature with optional `page` + `filters` inputs (additive).
- `app/[locale]/(public)/discover/_components/books-grid.tsx` — drop `<SlimFeaturedStrip>`, add `<DiscoveryModeToggle>`, dispatch by mode, shrink `SORT_OPTIONS` to recent + a-z.
- `app/[locale]/(public)/discover/_components/books-filters.tsx` — preserve mode param in `clearHref` (mode survives "Clear all").
- `AGENTS.md` — bookkeeping at W4 ship.

**Untouched:**
- Sidebar primitives, filter section tiles, card components, pagination component.

---

## Wave 1 — Pure helpers

No DB, no UI. Pure modules with unit tests so the algorithm is locked before action wiring.

### Task 1.1: `parseMode` URL helper

**Files:** `lib/discover/url-state.ts`, `lib/discover/__tests__/url-state.test.ts`

- [ ] Append to `lib/discover/url-state.ts`:
   ```ts
   export type ModeId = 'for-you' | 'trending' | 'popular' | 'all'
   export const MODE_IDS = ['for-you', 'trending', 'popular', 'all'] as const

   export function parseMode(raw: string | undefined | null): ModeId | undefined {
     if (raw && (MODE_IDS as readonly string[]).includes(raw)) {
       return raw as ModeId
     }
     return undefined
   }
   ```
- [ ] Add 4 tests to `lib/discover/__tests__/url-state.test.ts`:
   ```ts
   describe('parseMode', () => {
     it('returns the mode when valid', () => {
       expect(parseMode('for-you')).toBe('for-you')
       expect(parseMode('trending')).toBe('trending')
       expect(parseMode('popular')).toBe('popular')
       expect(parseMode('all')).toBe('all')
     })
     it('returns undefined when missing or unknown', () => {
       expect(parseMode(undefined)).toBeUndefined()
       expect(parseMode(null)).toBeUndefined()
       expect(parseMode('')).toBeUndefined()
       expect(parseMode('xyz')).toBeUndefined()
     })
   })
   ```
- [ ] Run `npx vitest run lib/discover/__tests__/url-state.test.ts` — expect all pass.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover/url-state): parseMode + MODE_IDS for hot-books mode toggle.`

### Task 1.2: `resolveDefaultMode` helper

**Files:** `lib/discover/resolve-default-mode.ts`, `lib/discover/__tests__/resolve-default-mode.test.ts`

- [ ] Create the module:
   ```ts
   import type { ModeId } from './url-state'

   /**
    * Resolves the default mode for /discover?tab=books when no `?mode=` URL param is set.
    * - Authed + has any discovery signal (≥1 follow, like, or own book) → 'for-you'
    * - Authed + zero signals (new account) → 'trending'
    * - Guest → 'trending'
    */
   export function resolveDefaultMode(opts: {
     isAuthed: boolean
     hasSignal: boolean
   }): ModeId {
     if (!opts.isAuthed) return 'trending'
     if (!opts.hasSignal) return 'trending'
     return 'for-you'
   }
   ```
- [ ] Add tests covering the 4 combinations:
   ```ts
   import { describe, it, expect } from 'vitest'
   import { resolveDefaultMode } from '../resolve-default-mode'

   describe('resolveDefaultMode', () => {
     it('guest always gets trending', () => {
       expect(resolveDefaultMode({ isAuthed: false, hasSignal: false })).toBe('trending')
       expect(resolveDefaultMode({ isAuthed: false, hasSignal: true })).toBe('trending')
     })
     it('authed + signal gets for-you', () => {
       expect(resolveDefaultMode({ isAuthed: true, hasSignal: true })).toBe('for-you')
     })
     it('authed + zero signal gets trending', () => {
       expect(resolveDefaultMode({ isAuthed: true, hasSignal: false })).toBe('trending')
     })
   })
   ```
- [ ] Run `npx vitest run lib/discover/__tests__/resolve-default-mode.test.ts` — pass.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover): resolveDefaultMode helper + tests.`

### Task 1.3: `tasteVector` helper

**Files:** `lib/discover/taste-vector.ts`, `lib/discover/__tests__/taste-vector.test.ts`

- [ ] Create the module:
   ```ts
   import { GENRES, type GenreSlug, isValidGenre } from './genres'

   export type SignalRow = { genre: string | null; weight: number }

   /**
    * Builds a taste vector from weighted signal rows and returns the top N genres.
    * - Null/invalid genres are silently dropped.
    * - Deterministic tiebreak: alphabetical by genre slug.
    * - Always returns up to N genres; fewer if there's insufficient signal.
    */
   export function topGenres(rows: SignalRow[], n: number): GenreSlug[] {
     const counts: Partial<Record<GenreSlug, number>> = {}
     for (const r of rows) {
       if (!r.genre || !isValidGenre(r.genre)) continue
       const g = r.genre as GenreSlug
       counts[g] = (counts[g] ?? 0) + r.weight
     }
     return (Object.keys(counts) as GenreSlug[])
       .sort((a, b) => {
         const da = counts[a] ?? 0
         const db = counts[b] ?? 0
         if (db !== da) return db - da
         return a.localeCompare(b)
       })
       .slice(0, n)
   }
   ```
- [ ] Add tests:
   ```ts
   import { describe, it, expect } from 'vitest'
   import { topGenres } from '../taste-vector'

   describe('topGenres', () => {
     it('returns empty when no signal', () => {
       expect(topGenres([], 3)).toEqual([])
     })
     it('weights are summed per genre', () => {
       expect(topGenres([
         { genre: 'fantasy', weight: 3 },
         { genre: 'fantasy', weight: 2 },
         { genre: 'sci-fi', weight: 4 },
       ], 3)).toEqual(['fantasy', 'sci-fi'])
     })
     it('alphabetical tiebreak when scores tie', () => {
       expect(topGenres([
         { genre: 'sci-fi', weight: 1 },
         { genre: 'romance', weight: 1 },
         { genre: 'fantasy', weight: 1 },
       ], 3)).toEqual(['fantasy', 'romance', 'sci-fi'])
     })
     it('drops null and invalid genres silently', () => {
       expect(topGenres([
         { genre: null, weight: 5 },
         { genre: 'not-a-real-genre', weight: 5 },
         { genre: 'fantasy', weight: 1 },
       ], 3)).toEqual(['fantasy'])
     })
     it('returns at most N entries', () => {
       expect(topGenres([
         { genre: 'fantasy', weight: 1 },
         { genre: 'sci-fi', weight: 2 },
         { genre: 'romance', weight: 3 },
         { genre: 'mystery', weight: 4 },
       ], 2)).toEqual(['mystery', 'romance'])
     })
   })
   ```
- [ ] Run `npx vitest run lib/discover/__tests__/taste-vector.test.ts` — pass.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover): tasteVector topGenres helper + tests.`

---

## Wave 2 — New actions

### Task 2.1: `hasAnyDiscoverySignalAction`

**Files:** `lib/actions/discover-for-you-books.actions.ts`, `lib/actions/__tests__/discover-for-you-books-actions.test.ts`

- [ ] Create the action file with:
   ```ts
   'use server'
   import { cache } from 'react'
   import { db } from '@/db'
   import { books, follows, bookLikes } from '@/db/schema'
   import { eq, and } from 'drizzle-orm'

   /**
    * Returns true if the viewer has any discovery signal: at least one follow,
    * one book like, or one own book. Used by resolveDefaultMode to decide
    * whether to default to For You or Trending.
    *
    * React `cache()` so multiple call sites in the same request dedupe.
    */
   export const hasAnyDiscoverySignalAction = cache(
     async (viewerId: string): Promise<boolean> => {
       const [followRow] = await db
         .select({ id: follows.followerId })
         .from(follows)
         .where(eq(follows.followerId, viewerId))
         .limit(1)
       if (followRow) return true

       const [likeRow] = await db
         .select({ userId: bookLikes.userId })
         .from(bookLikes)
         .where(eq(bookLikes.userId, viewerId))
         .limit(1)
       if (likeRow) return true

       const [ownBookRow] = await db
         .select({ id: books.id })
         .from(books)
         .where(eq(books.userId, viewerId))
         .limit(1)
       return !!ownBookRow
     },
   )
   ```
- [ ] Create the test file with the proxy-db mock (mirror `discover-actions.test.ts`'s `makeQueryProxy`).
- [ ] Add surface-shape test:
   ```ts
   it('hasAnyDiscoverySignalAction is exported as an async function', async () => {
     expect(typeof forYouActions.hasAnyDiscoverySignalAction).toBe('function')
     const r = await forYouActions.hasAnyDiscoverySignalAction('user-1')
     expect(typeof r).toBe('boolean')
   })
   ```
- [ ] Run `npm test -- discover-for-you-books-actions` — pass.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover/for-you): hasAnyDiscoverySignalAction.`

### Task 2.2: `getPopularBooksAction`

**File:** `lib/actions/discover-for-you-books.actions.ts` (append)

- [ ] Append the action:
   ```ts
   import {
     buildPublicBookFilters,
     projectToBookCards,
     getBlockedAuthorIdsForViewer,
     type BookCard,
     PAGE_SIZE_BOOKS, // export from discover.actions.ts as a const (12)
   } from './discover.actions'
   import type { ActionResult } from './book.actions'
   import { getOptionalUserId } from '@/lib/require-auth'
   import { count, desc, sql } from 'drizzle-orm'
   import { books, bookLikes } from '@/db/schema'

   type FilterInputs = {
     q?: string
     genres?: string[]
     length?: 'any' | 'short' | 'novella' | 'novel' | 'epic'
     status?: 'any' | 'ongoing' | 'completed'
     series?: 'any' | 'standalone' | 'in-series'
     updated?: 'anytime' | 'week' | 'month'
   }

   export async function getPopularBooksAction(args: {
     page?: number
     filters?: FilterInputs
   }): Promise<ActionResult<{ books: BookCard[]; totalCount: number }>> {
     const viewerId = await getOptionalUserId()
     const blocked = await getBlockedAuthorIdsForViewer(viewerId)
     const page = Math.max(1, Math.floor(args.page ?? 1))
     const offset = (page - 1) * PAGE_SIZE_BOOKS

     const filters = buildPublicBookFilters(undefined, blocked)
     // Apply args.filters via the same per-clause logic searchBooksDiscoverAction uses.
     // [Plan note: extract `applyBookFilterInputs(filters, args.filters)` helper in
     // discover.actions.ts so both actions share the WHERE-clause logic without
     // duplication. Add the helper as part of this task.]

     // Total count query — runs in parallel with the page fetch.
     const [totalCountRows, pageRows] = await Promise.all([
       db.select({ total: count(books.id) }).from(books).where(and(...filters)),
       db
         .select({
           id: books.id, title: books.title, authorUserId: books.userId,
           coverUrl: books.coverUrl, synopsis: books.synopsis,
           genre: books.genre, tags: books.tags, updatedAt: books.updatedAt,
           firstPubliclyDiscoverableAt: books.firstPubliclyDiscoverableAt,
           likeCount: sql<number>`(SELECT COUNT(*) FROM ${bookLikes} WHERE ${bookLikes.bookId} = ${books.id})`,
         })
         .from(books)
         .where(and(...filters))
         .orderBy(
           desc(sql`(SELECT COUNT(*) FROM ${bookLikes} WHERE ${bookLikes.bookId} = ${books.id})`),
           desc(books.id),
         )
         .limit(PAGE_SIZE_BOOKS)
         .offset(offset),
     ])
     const totalCount = Number(totalCountRows[0]?.total ?? 0)
     const cards = await projectToBookCards(pageRows)
     return { success: true, data: { books: cards, totalCount } }
   }
   ```
- [ ] **First sub-step:** in `lib/actions/discover.actions.ts`, extract a new exported helper `applyBookFilterInputs(filters, input)` that takes the existing `filters` array + the optional `{ q, genres, length, status, series, updated }` and pushes the right WHERE conditions (this is the exact logic from W2.1 `searchBooksDiscoverAction`). Re-wire `searchBooksDiscoverAction` to use it. Also export a `PAGE_SIZE_BOOKS = 12` const (or alias the existing `RAIL_LIMIT`).
- [ ] Run `npm test` — full suite passes.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Add surface-shape test for `getPopularBooksAction` (empty input + with filters + composition).
- [ ] Commit `feat(discover/for-you): getPopularBooksAction + applyBookFilterInputs extract.`

### Task 2.3: `getForYouBooksAction` — Tier 1 (followed authors)

**File:** `lib/actions/discover-for-you-books.actions.ts` (append)

- [ ] Implement the Tier 1 fetch as a standalone helper inside the action file:
   ```ts
   import { follows, bookLikes, chapterReads } from '@/db/schema'
   import { inArray, notInArray, isNotNull } from 'drizzle-orm'

   async function tier1Candidates(opts: {
     viewerId: string
     filters: (typeof books._.columns)[]
     filterInputs: FilterInputs
     limit: number
   }): Promise<Array<{ id: string; title: string; /*...*/ }>> {
     // Subqueries: followed authors, liked book ids, read book ids.
     const followedAuthorIdsSubquery = db
       .select({ id: follows.followeeId })
       .from(follows)
       .where(eq(follows.followerId, opts.viewerId))
     const likedBookIdsSubquery = db
       .select({ id: bookLikes.bookId })
       .from(bookLikes)
       .where(eq(bookLikes.userId, opts.viewerId))
     const readBookIdsSubquery = db
       .select({ id: chapterReads.bookId })
       .from(chapterReads)
       .where(eq(chapterReads.userId, opts.viewerId))

     // Compose: public filters + author IN follows + not in liked + not in read
     const conds = [
       ...buildPublicBookFilters(undefined, new Set()),
       inArray(books.userId, followedAuthorIdsSubquery),
       notInArray(books.id, likedBookIdsSubquery),
       notInArray(books.id, readBookIdsSubquery),
     ]
     // Apply the user-supplied filter inputs:
     applyBookFilterInputs(conds, opts.filterInputs)

     return db
       .select({/* projection same as getPopularBooks */})
       .from(books)
       .where(and(...conds))
       .orderBy(desc(books.updatedAt), desc(books.id))
       .limit(opts.limit)
   }
   ```
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover/for-you): tier1Candidates — followed authors not already read.`

### Task 2.4: `getForYouBooksAction` — Tier 2 (taste vector genre match)

- [ ] Append `tier2Candidates(opts)` to the action file:
   ```ts
   async function tier2Candidates(opts: {
     viewerId: string
     excludeIds: Set<string>
     filterInputs: FilterInputs
     limit: number
   }): Promise<Array<{ /*projection*/ }>> {
     // Step 1: fetch the viewer's signal rows (3 parallel queries):
     const [likedGenres, followedAuthorGenres, ownBookGenres] = await Promise.all([
       db.select({ genre: books.genre })
         .from(bookLikes)
         .innerJoin(books, eq(books.id, bookLikes.bookId))
         .where(eq(bookLikes.userId, opts.viewerId)),
       // followed authors' most recent book genre — naive impl: all books they own
       db.select({ genre: books.genre })
         .from(follows)
         .innerJoin(books, eq(books.userId, follows.followeeId))
         .where(eq(follows.followerId, opts.viewerId)),
       db.select({ genre: books.genre })
         .from(books)
         .where(eq(books.userId, opts.viewerId)),
     ])

     // Step 2: weighted signal rows.
     const rows: SignalRow[] = [
       ...likedGenres.map((r) => ({ genre: r.genre, weight: 3 })),
       ...followedAuthorGenres.map((r) => ({ genre: r.genre, weight: 2 })),
       ...ownBookGenres.map((r) => ({ genre: r.genre, weight: 1 })),
     ]
     const topThree = topGenres(rows, 3)
     if (topThree.length === 0) return []

     // Step 3: fetch books in those genres, excluding tier1 ids, ranked by trending.
     const conds = [
       ...buildPublicBookFilters(undefined, new Set()),
       inArray(books.genre, topThree),
     ]
     if (opts.excludeIds.size > 0) {
       conds.push(notInArray(books.id, Array.from(opts.excludeIds)))
     }
     applyBookFilterInputs(conds, opts.filterInputs)

     // [Plan note: rank by computeTrendingScore in JS over a 200-row candidate
     // window so we can apply the 7d signal joins (likes/comments/reads/follows)
     // without pulling the COUNT() into the main query plan.]
     const candidates = await db.select(/*...*/).from(books).where(and(...conds)).limit(200)
     const scored = await rankByTrendingScore(candidates) // mirror getTrendingBooksAction
     return scored.slice(0, opts.limit)
   }
   ```
- [ ] **Extract `rankByTrendingScore(candidates)`** as a shared helper in `discover.actions.ts` so both `getTrendingBooksAction` and `tier2Candidates` use the same scoring logic. (Plan note: this should already exist as inline logic in `getTrendingBooksAction` — extract first, then use.)
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover/for-you): tier2Candidates — taste-vector genre match.`

### Task 2.5: `getForYouBooksAction` — Tier 3 (platform top genres fallback)

- [ ] First, create `lib/discover/platform-top-genres.ts`:
   ```ts
   import { unstable_cache } from 'next/cache'
   import { db } from '@/db'
   import { follows, books } from '@/db/schema'
   import { eq, isNotNull } from 'drizzle-orm'
   import { topGenres } from './taste-vector'
   import { isValidGenre, type GenreSlug } from './genres'

   /**
    * Computes the platform's most-followed 3 genres, where each follow is
    * attributed to the followee's most-recently-published book's genre.
    * Cached 1h via unstable_cache.
    */
   export const getPlatformTopGenres = unstable_cache(
     async (): Promise<GenreSlug[]> => {
       const rows = await db
         .select({ genre: books.genre })
         .from(follows)
         .innerJoin(books, eq(books.userId, follows.followeeId))
         .where(isNotNull(books.genre))
       return topGenres(rows.map((r) => ({ genre: r.genre, weight: 1 })), 3)
     },
     ['platform-top-genres'],
     { revalidate: 3600, tags: ['platform-top-genres'] },
   )
   ```
- [ ] Append `tier3Candidates(opts)` to the action file using `getPlatformTopGenres()` + the existing trending-rank pattern:
   ```ts
   async function tier3Candidates(opts: {
     excludeIds: Set<string>
     filterInputs: FilterInputs
     limit: number
   }): Promise<Array<{ /*projection*/ }>> {
     const topThree = await getPlatformTopGenres()
     if (topThree.length === 0) return []
     const conds = [
       ...buildPublicBookFilters(undefined, new Set()),
       inArray(books.genre, topThree),
     ]
     if (opts.excludeIds.size > 0) {
       conds.push(notInArray(books.id, Array.from(opts.excludeIds)))
     }
     applyBookFilterInputs(conds, opts.filterInputs)
     const candidates = await db.select(/*...*/).from(books).where(and(...conds)).limit(200)
     const scored = await rankByTrendingScore(candidates)
     return scored.slice(0, opts.limit)
   }
   ```
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover/for-you): tier3Candidates + platform top genres cached helper.`

### Task 2.6: `getForYouBooksAction` orchestrator + stitching

- [ ] Append the main action to the action file:
   ```ts
   /**
    * For You is a 3-tier hybrid. Returns up to PAGE_SIZE books per page in the
    * order [Tier 1: 6][Tier 2: 4][Tier 3: 2], with tier overflow filling the
    * remaining slots if a tier comes up short.
    *
    * The total count is conservatively bounded at 180 (60 per tier × 3 tiers).
    */
   const TIER_QUOTAS = { tier1: 6, tier2: 4, tier3: 2 } as const
   const TIER_FETCH_LIMIT = 60

   export async function getForYouBooksAction(args: {
     viewerId: string
     page?: number
     filters?: FilterInputs
   }): Promise<
     ActionResult<{
       books: BookCard[]
       totalCount: number
       tierBreakdown: { tier1: number; tier2: number; tier3: number }
     }>
   > {
     const page = Math.max(1, Math.floor(args.page ?? 1))
     const filterInputs = args.filters ?? {}

     // Tier 1 candidates (60 max).
     const t1 = await tier1Candidates({
       viewerId: args.viewerId,
       filterInputs,
       limit: TIER_FETCH_LIMIT,
       filters: [],
     })
     const t1Ids = new Set(t1.map((r) => r.id))

     // Tier 2 candidates (60 max, excluding tier 1).
     const t2 = await tier2Candidates({
       viewerId: args.viewerId,
       excludeIds: t1Ids,
       filterInputs,
       limit: TIER_FETCH_LIMIT,
     })
     const t12Ids = new Set([...t1Ids, ...t2.map((r) => r.id)])

     // Tier 3 candidates (60 max, excluding tier 1 ∪ tier 2).
     const t3 = await tier3Candidates({
       excludeIds: t12Ids,
       filterInputs,
       limit: TIER_FETCH_LIMIT,
     })

     // Total count = sum of the three tiers (deduped). Bounded by 180.
     const totalCount = t1.length + t2.length + t3.length

     // Page slice: 6/4/2 ratio per page. Walk forward by full pages.
     const startIdx = (page - 1) * PAGE_SIZE_BOOKS
     const t1Page = t1.slice(startIdx * TIER_QUOTAS.tier1 / PAGE_SIZE_BOOKS,
                            startIdx * TIER_QUOTAS.tier1 / PAGE_SIZE_BOOKS + TIER_QUOTAS.tier1)
     const t2Page = t2.slice(startIdx * TIER_QUOTAS.tier2 / PAGE_SIZE_BOOKS,
                            startIdx * TIER_QUOTAS.tier2 / PAGE_SIZE_BOOKS + TIER_QUOTAS.tier2)
     const t3Page = t3.slice(startIdx * TIER_QUOTAS.tier3 / PAGE_SIZE_BOOKS,
                            startIdx * TIER_QUOTAS.tier3 / PAGE_SIZE_BOOKS + TIER_QUOTAS.tier3)

     // Stitch — overflow handling: if a tier is short on this page, the next
     // tier(s) backfill to keep the page at PAGE_SIZE_BOOKS where possible.
     const stitched = [...t1Page, ...t2Page, ...t3Page]
     // (Plan-time refinement: the exact overflow algorithm should be unit
     // tested. Add a `stitchTiers(t1, t2, t3, page)` pure helper at
     // lib/discover/stitch-tiers.ts with covering tests in 2.7.)

     const cards = await projectToBookCards(stitched)
     return {
       success: true,
       data: {
         books: cards,
         totalCount,
         tierBreakdown: { tier1: t1.length, tier2: t2.length, tier3: t3.length },
       },
     }
   }
   ```
- [ ] **Note** — the inline `stitched` algorithm above is the rough shape. **Promote `stitchTiers` to a pure helper** at `lib/discover/stitch-tiers.ts` so it can be unit-tested independently. Move the algorithm there in a follow-up sub-step within this same task.
- [ ] Surface-shape test: `getForYouBooksAction` is exported as an async function with the expected return type.
- [ ] Run `npm test` — full suite passes.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover/for-you): getForYouBooksAction orchestrator + 6/4/2 tier stitch.`

### Task 2.7: `stitchTiers` pure helper + tests

**Files:** `lib/discover/stitch-tiers.ts`, `lib/discover/__tests__/stitch-tiers.test.ts`

- [ ] Move the page-slicing math out of `getForYouBooksAction` into a pure helper:
   ```ts
   export function stitchTiers<T>(opts: {
     t1: T[]
     t2: T[]
     t3: T[]
     page: number
     pageSize: number
     quotas: { tier1: number; tier2: number; tier3: number }
   }): T[] {
     // Walk forward through each tier proportionally per page.
     // Quotas sum to pageSize: { tier1: 6, tier2: 4, tier3: 2 }.
     // Overflow rule: if tier1 has fewer rows for this page than its quota,
     // tier2 backfills; if tier1+tier2 still short, tier3 backfills.
     // [Implementation deferred to plan-time — keep deterministic + simple.]
   }
   ```
- [ ] Add tests for:
   - Page 1, all tiers full: 6 from t1, 4 from t2, 2 from t3.
   - Page 1, t1 has 3 rows: 3 from t1, then t2 backfills with 7 (4+3), then t3 with 2.
   - Page 2, after consuming 12 total: walks forward correctly.
   - Page 1, empty t1+t2: 12 from t3 (or fewer if t3 short).
   - Page 1, all empty: empty array.
- [ ] Update `getForYouBooksAction` to call `stitchTiers`.
- [ ] Run `npm test` — pass.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover/for-you): stitchTiers pure helper + tests.`

---

## Wave 3 — Extend Trending action

### Task 3.1: Widen `getTrendingBooksAction` to accept page + filters

**File:** `lib/actions/discover.actions.ts`

- [ ] Read the current `getTrendingBooksAction` signature.
- [ ] Widen its input args additively:
   ```ts
   export async function getTrendingBooksAction(args: {
     genre?: string             // legacy
     cursor?: string | null     // legacy
     page?: number              // NEW
     filters?: FilterInputs     // NEW
   }): Promise<
     ActionResult<{
       books: BookCard[]
       nextCursor: string | null
       totalCount: number       // NEW required
     }>
   >
   ```
- [ ] In the body, when `args.page` is set:
   - Compute offset = (page-1) * RAIL_LIMIT.
   - Apply `applyBookFilterInputs` to the filter array (same helper from Task 2.2).
   - Use SQL `.offset(offset)` (or slice the JS-ranked candidate window at offset).
   - Add parallel COUNT query for totalCount.
   - Cursor logic bypassed; return null.
- [ ] Backwards-compat: when `args.page` is absent, behave exactly as today. Update existing call sites to pass the new shape OR leave them on the legacy shape (additive only).
- [ ] Run `npm test` — full suite passes.
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover): getTrendingBooksAction accepts page + filters + totalCount.`

---

## Wave 4 — UI: `<DiscoveryModeToggle>` component

### Task 4.1: Build the toggle

**File:** `app/[locale]/(public)/discover/_components/discovery-mode-toggle.tsx`

- [ ] Create the client component:
   ```tsx
   'use client'
   import Link from 'next/link'
   import { Sparkles, Flame, Star, Library } from 'lucide-react'
   import { buildUrl, type TabId, type ModeId } from '@/lib/discover/url-state'
   import { useFilterNav } from './use-filter-nav'

   type Mode = { id: ModeId; label: string; Icon: React.ComponentType<{ size?: number }> }

   const ALL_MODES: Mode[] = [
     { id: 'for-you', label: 'For You', Icon: Sparkles },
     { id: 'trending', label: 'Trending', Icon: Flame },
     { id: 'popular', label: 'Popular', Icon: Star },
     { id: 'all', label: 'All', Icon: Library },
   ]

   type Props = {
     tab: TabId
     locale: string
     current: ModeId
     isAuthed: boolean
     /** Other URL params to preserve on each mode link. */
     baseParams: Record<string, string | string[] | undefined>
   }

   export function DiscoveryModeToggle({ tab, locale, current, isAuthed, baseParams }: Props) {
     const modes = isAuthed ? ALL_MODES : ALL_MODES.filter((m) => m.id !== 'for-you')
     const hrefFor = (modeId: ModeId): string => {
       const params: typeof baseParams = { ...baseParams }
       delete params.page
       if (modeId === 'trending' || modeId === 'for-you' && !isAuthed) {
         delete params.mode  // default mode omits the param
       } else {
         params.mode = modeId
       }
       return buildUrl(tab, params, `/${locale}/discover`)
     }
     return (
       <nav
         className="inline-flex items-center gap-0 rounded-xl p-1 self-start"
         style={{ background: 'rgba(255, 255, 255, 0.04)' }}
         aria-label="Discovery mode"
       >
         {modes.map((m) => {
           const isActive = m.id === current
           const className = isActive
             ? 'inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-bold rounded-lg'
             : 'inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] text-[var(--canvas-dark-ink)] hover:text-[var(--brand)] transition-colors rounded-lg'
           if (isActive) {
             return (
               <span
                 key={m.id}
                 className={className}
                 style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
                 aria-current="page"
               >
                 <m.Icon size={13} />
                 {m.label}
               </span>
             )
           }
           return (
             <Link key={m.id} href={hrefFor(m.id)} className={className}>
               <m.Icon size={13} />
               {m.label}
             </Link>
           )
         })}
       </nav>
     )
   }
   ```
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover): DiscoveryModeToggle component.`

---

## Wave 5 — Wire BooksGrid

### Task 5.1: BooksGrid mode dispatch + render

**File:** `app/[locale]/(public)/discover/_components/books-grid.tsx`

- [ ] Imports:
   - Drop `SlimFeaturedStrip`, `getFeaturedFreshBookAction`.
   - Add `DiscoveryModeToggle`, `parseMode`, `resolveDefaultMode`, `hasAnyDiscoverySignalAction`, `getForYouBooksAction`, `getPopularBooksAction`, `getTrendingBooksAction`.
- [ ] Auth check at top of `BooksGrid({ sp, locale })`:
   ```ts
   const session = await auth.api.getSession({ headers: await headers() })
   const viewerId = session?.user?.id ?? null
   const isAuthed = !!viewerId
   ```
- [ ] Mode resolution:
   ```ts
   const rawMode = parseMode(pickRaw(sp, 'mode'))
   let resolvedMode: ModeId
   if (rawMode) {
     // Guest hit ?mode=for-you → silently fall back to trending per spec §13 #10.
     resolvedMode = rawMode === 'for-you' && !isAuthed ? 'trending' : rawMode
   } else {
     const hasSignal = isAuthed ? await hasAnyDiscoverySignalAction(viewerId!) : false
     resolvedMode = resolveDefaultMode({ isAuthed, hasSignal })
   }
   ```
- [ ] Build filter inputs once:
   ```ts
   const filterInputs = { q, genres, length, status, series, updated }
   ```
- [ ] Mode dispatch:
   ```ts
   const resultsRes = await (() => {
     switch (resolvedMode) {
       case 'for-you':
         return getForYouBooksAction({ viewerId: viewerId!, page, filters: filterInputs })
       case 'trending':
         return getTrendingBooksAction({ page, filters: filterInputs })
       case 'popular':
         return getPopularBooksAction({ page, filters: filterInputs })
       case 'all':
         return searchBooksDiscoverAction({
           q, genres, length, status, series, updated,
           sort: mapSortToAction(sort), page,
         })
     }
   })()
   ```
- [ ] Drop the parallel featured fetch + `<SlimFeaturedStrip>` JSX.
- [ ] Add `<DiscoveryModeToggle>` at the top of the returned JSX:
   ```tsx
   <DiscoveryModeToggle
     tab="books"
     locale={locale}
     current={resolvedMode}
     isAuthed={isAuthed}
     baseParams={{ /* all current filter + sort params, excluding mode */ }}
   />
   <SortHeader ... />
   ```
- [ ] Narrow `SORT_OPTIONS`:
   ```ts
   const SORT_OPTIONS = [
     { value: 'recent', label: 'Most recent' },
     { value: 'a-z', label: 'A–Z' },
   ] as const
   ```
   Narrow the `SORTS` parsing tuple to match.
- [ ] Preserve mode in pagination `baseParams`.
- [ ] Run `npm run dev` and visit `/en/discover?tab=books`. Smoke targets:
   - As guest → 3-button toggle (Trending active), no For You button.
   - As authed with seeds → 4-button toggle; For You active by default.
   - Switching modes updates `?mode=X`; pagination preserves mode; "Clear all" preserves mode.
- [ ] Run `npm test` — full suite passes (or only flaky tests known).
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover/books): wire DiscoveryModeToggle + mode dispatch + narrow sort.`

### Task 5.2: BooksFilters preserves mode in clearHref

**File:** `app/[locale]/(public)/discover/_components/books-filters.tsx`

- [ ] Update `clearHref` to read `?mode=` from sp and preserve it:
   ```ts
   const mode = pickRaw(sp, 'mode')
   const clearHref =
     `/${locale}/discover?tab=books${mode ? `&mode=${mode}` : ''}`
   ```
- [ ] Run `npx tsc --noEmit` — clean.
- [ ] Commit `feat(discover/books): BooksFilters preserves mode on Clear all.`

---

## Wave 6 — Ship

### Task 6.1: Manual smoke

Per spec §13. Run `npm run seed:discover` to refresh the dev DB, then exercise on `/en/discover?tab=books`:

- [ ] Guest → 3-button toggle, Trending active, no For You. Refresh keeps Trending.
- [ ] Authed (any seeded user) → 4-button toggle. If the account has follows/likes → For You active; else Trending active.
- [ ] Click For You → URL gains `?mode=for-you`, grid reloads.
- [ ] Click Trending → URL drops `?mode=` param (default), grid reloads.
- [ ] Click Popular → URL `?mode=popular`, grid sorts by total like count desc.
- [ ] Click All → URL `?mode=all`, grid uses sort dropdown.
- [ ] Sort dropdown shows ONLY Most recent + A-Z.
- [ ] In For You mode, filter to Genre=Fantasy → grid narrows; mode persists; pagination preserves mode.
- [ ] Pagination on For You → page 2 takes the next 12 books, preserving 6/4/2 tier split.
- [ ] "Clear all (N)" → wipes filters but keeps mode.
- [ ] URL `?mode=for-you` as a logged-out viewer → grid renders Trending silently (no error).
- [ ] No console errors; no hydration warnings.

### Task 6.2: AGENTS.md bookkeeping + ship

- [ ] Update AGENTS.md Resume Here: Last commit → ship commit SHA · Last updated → ship date · Current focus → "Hot Books shipped, awaiting Sparks/Hives/Lists/Clubs follow-up specs."
- [ ] Append to "What Has Been Built" with: wave SHA map, deferred follow-ups, new patterns now load-bearing (mode toggle pattern, taste-vector helper).
- [ ] Note in "What's Next" that the pattern applies to Sparks/Hives/Lists/Clubs.
- [ ] Commit `docs(agents): Hot Books discovery surface shipped.`
- [ ] Run `git push origin main`.

---

## Deferred follow-ups (write into AGENTS.md at ship)

1. **Real-time For You refresh** — currently static per request; doesn't react to mid-session follows.
2. **Tunable tier weights** — `(3, 2, 1)` and `(6, 4, 2)` are static; could become configurable.
3. **Telemetry on mode clicks** — would help tune weights once we have real users.
4. **For You per-mode pagination memory** — each mode resets to page 1 on switch.
5. **Cross-entity Home For You** — Discover Home keeps its existing curated rail.
6. **Apply pattern to Sparks/Hives/Lists/Clubs** — separate specs per entity, see spec §11.
7. **Move from inline trending-rank to materialized view** — if Tier 2/Tier 3 trending scoring becomes a hot path.

---

## Self-review notes

- **Spec coverage:** Every spec §13 acceptance criterion has a smoke step in Task 6.1. Every spec §3 page IA element maps to a UI task in Wave 5. Every spec §7 action is built in Wave 2.
- **Type consistency:** `ModeId` defined once in `lib/discover/url-state.ts`; consumed by toggle + resolver + grid dispatch. `FilterInputs` defined in the new action file and exported; reused by Trending action extension in Wave 3.
- **No placeholders:** "Plan note" comments inline are deliberate plan-time decisions documented for the executor (not unresolved TODOs). The `stitchTiers` algorithm is sketched in Task 2.6 and promoted to its own pure helper in Task 2.7 so the executor doesn't have to invent it.
- **File responsibility:** New code lives in 4 new files + 4 modified files. Average file size <300 LOC. `discover.actions.ts` grows by ~50 LOC (the `applyBookFilterInputs` extract); no other file grows past plan threshold.
