'use server'

import { unstable_cache } from 'next/cache'
import { db } from '@/db'
import {
  books,
  binderItems,
  chapters,
  bookLikes,
  bookmarks,
  bookComments,
} from '@/db/schema'
import { userProfiles } from '@/db/schema'
import { follows, chapterReads } from '@/db/schema/social'
import {
  and,
  eq,
  desc,
  sql,
  count,
  isNull,
  ilike,
  or,
  ne,
  gte,
  inArray,
  notInArray,
  lt,
} from 'drizzle-orm'
import { requireAuth, getOptionalUserId } from '@/lib/require-auth'
import { canReadBook } from '@/lib/books/can-read'
import { isBlocked } from '@/lib/social/is-blocked'
import { searchBooksSchema } from '@/lib/validations/reading-list'
import { applyBackfill } from '@/lib/discover/backfill'
import {
  GENRES,
  normalizeGenre,
  isValidGenre,
  type GenreSlug,
} from '@/lib/discover/genres'
import {
  computeTrendingScore,
  computeRisingStarsScore,
} from '@/lib/discover/scoring'
import {
  PAGE_SIZE_BOOKS,
  getBlockedAuthorIdsForViewer,
  buildPublicBookFilters,
  projectToBookCards,
  applyBookFilterInputs,
  loadTrendingSignals,
  loadCumulativeBookCounts,
  type BookCard,
  type FilterInputs,
  type RawBookRow,
  type TrendingSignalCounts,
} from './discover-shared'

import type { ActionResult } from './book.actions'

// ─── Public types ─────────────────────────────────────────────────────────────

// BookCard moved to ./discover-shared.ts (re-exported here for back-compat).
export type { BookCard, FilterInputs } from './discover-shared'

export type RailResult<TItem = BookCard> = {
  books: TItem[]
  strictCount: number
  nextCursor: string | null
}

// Legacy types preserved for non-discover consumers (book reader, AddBookModal).

export type PublicBook = {
  id: string
  title: string
  genre: string | null
  coverUrl: string | null
  synopsis: string | null
  tags: string[] | null
  updatedAt: Date
  authorUserId: string
  authorUsername: string | null
  authorDisplayName: string | null
  authorAvatarUrl: string | null
  likeCount: number
  bookmarkCount: number
  chapterCount: number
  wordCount: number
  seriesName: string | null
  seriesNumber: number | null
}

export type BookComment = {
  id: string
  content: string
  createdAt: Date
  authorUsername: string | null
  authorDisplayName: string | null
  authorAvatarUrl: string | null
}

// Legacy projected row shape (pre-D1). Preserved for `book-card.tsx`'s
// continued use until T6 swaps the home Books tab to <DiscoverBookCard> /
// <RailBookCard>. New code should use BookCard instead.
export type DiscoverBook = {
  id: string
  title: string
  genre: string | null
  coverUrl: string | null
  synopsis: string | null
  tags: string[] | null
  updatedAt: Date
  likeCount: number
  bookmarkCount: number
  wordCount: number
  authorUsername: string | null
  authorDisplayName: string | null
  seriesName: string | null
  seriesNumber: number | null
}

export type DiscoverWriter = {
  userId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  bookCount: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

// ─── Cursor helpers ───────────────────────────────────────────────────────────

type CursorPayload = { sortKey: string | number; id: string } | null

function encodeCursor(p: { sortKey: string | number; id: string }): string {
  return Buffer.from(JSON.stringify(p)).toString('base64url')
}

function decodeCursor(s: string | null | undefined): CursorPayload {
  if (!s) return null
  try {
    const parsed = JSON.parse(Buffer.from(s, 'base64url').toString())
    if (
      parsed &&
      typeof parsed.id === 'string' &&
      (typeof parsed.sortKey === 'string' || typeof parsed.sortKey === 'number')
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * §6.3 query widened to 30d, used as the universal backfill source for all
 * rails. Returns RawBookRow[] sorted by MAX(chapters.updated_at) DESC.
 */
async function getRecentlyUpdatedRowsInternal(
  genre: GenreSlug | undefined,
  excludeIds: string[],
  blockedAuthorIds: Set<string>,
  limit: number,
  windowMs: number = THIRTY_DAYS_MS,
): Promise<RawBookRow[]> {
  const windowStart = new Date(Date.now() - windowMs)
  const filters = buildPublicBookFilters(genre, blockedAuthorIds)
  if (excludeIds.length > 0) {
    filters.push(notInArray(books.id, excludeIds))
  }
  // Aggregate over chapters in window.
  const lastUpdateRows = await db
    .select({
      bookId: chapters.bookId,
      last: sql<Date>`MAX(${chapters.updatedAt})`,
    })
    .from(chapters)
    .where(
      and(
        inArray(chapters.status, ['REVISED', 'FINAL']),
        gte(chapters.updatedAt, windowStart),
      ),
    )
    .groupBy(chapters.bookId)
    .orderBy(desc(sql`MAX(${chapters.updatedAt})`))
    .limit(limit * 4)

  if (lastUpdateRows.length === 0) return []
  const candidateIds = lastUpdateRows.map((r) => r.bookId)

  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      authorUserId: books.userId,
      coverUrl: books.coverUrl,
      synopsis: books.synopsis,
      genre: books.genre,
      tags: books.tags,
      updatedAt: books.updatedAt,
      firstPubliclyDiscoverableAt: books.firstPubliclyDiscoverableAt,
    })
    .from(books)
    .where(and(...filters, inArray(books.id, candidateIds)))

  // Re-order by lastUpdate map and slice to limit.
  const lastUpdateMap = new Map(
    lastUpdateRows.map((r) => [r.bookId, r.last as Date]),
  )
  const sorted = rows
    .filter((r) => lastUpdateMap.has(r.id))
    .sort((a, b) => {
      const al = lastUpdateMap.get(a.id)!.getTime()
      const bl = lastUpdateMap.get(b.id)!.getTime()
      if (al !== bl) return bl - al
      return b.id.localeCompare(a.id)
    })
    .slice(0, limit)
  return sorted
}

/**
 * Top-up wrapper used by every rail action. If strict result is short, runs
 * the §6.3 backfill query widened to 30d and merges via applyBackfill.
 */
async function railWithBackfill(
  strictRows: RawBookRow[],
  genre: GenreSlug | undefined,
  blockedAuthorIds: Set<string>,
  nextCursor: string | null,
): Promise<RailResult> {
  if (strictRows.length >= 4) {
    const cards = await projectToBookCards(strictRows)
    return {
      books: cards,
      strictCount: strictRows.length,
      nextCursor,
    }
  }
  const excludeIds = strictRows.map((r) => r.id)
  const backfill = await getRecentlyUpdatedRowsInternal(
    genre,
    excludeIds,
    blockedAuthorIds,
    4,
    THIRTY_DAYS_MS,
  )
  const merged = applyBackfill(strictRows, backfill)
  const cards = await projectToBookCards(merged.books as RawBookRow[])
  return {
    books: cards,
    strictCount: merged.strictCount,
    nextCursor,
  }
}

// Issue #32: `getFeaturedFreshBookAction` removed — the discovery mode toggle
// replaces the featured banner.

// ─── Trending signal loader (shared by Trending + Rising Stars) ───────────────
// `loadTrendingSignals` + `TrendingSignalCounts` live in `./discover-shared`
// so the For You orchestrator can reuse them. Re-aliased here for local refs.

type SignalCounts = TrendingSignalCounts

// ─── 2. Trending Now ──────────────────────────────────────────────────────────

// TODO(#32): wrap the candidate-ranking inner body in `unstable_cache` (5min TTL)
// keyed on (genre, filtersHash). Skipped today because the action body interleaves
// viewer-state (blocked-author filter, optional auth) with the ranking math; a
// clean cache wrap requires factoring the inner ranking out into a pure helper
// that takes pre-filtered candidate ids. Cumulative-count queries + age-decay
// math are cheap enough at current scale that this isn't blocking.
export async function getTrendingBooksAction(args: {
  genre?: string
  cursor?: string | null
  window?: '24h' | '7d'
  /** 1-indexed page number for numbered pagination. When set, overrides cursor. */
  page?: number
  /** Multi-filter input shape used by Hot Books grid (W3). */
  filters?: FilterInputs
}): Promise<
  ActionResult<{
    books: BookCard[]
    strictCount: number
    nextCursor: string | null
    totalCount: number
  }>
> {
  const viewerId = await getOptionalUserId()
  const blockedAuthorIds = await getBlockedAuthorIdsForViewer(viewerId)
  const genre =
    args.genre && isValidGenre(args.genre) ? (args.genre as GenreSlug) : undefined
  const windowMs = args.window === '24h' ? TWENTY_FOUR_HOURS_MS : SEVEN_DAYS_MS
  const cursor = decodeCursor(args.cursor)
  const usePagination = (args.page ?? 0) > 0
  const page = Math.max(1, Math.floor(args.page ?? 1))
  const offset = (page - 1) * PAGE_SIZE_BOOKS

  // Step 1: pick a candidate set. We pull the top N most-recently-active books
  // (over the window) and compute scores in JS. Cap candidate set to keep the
  // signal queries bounded.
  const windowStart = new Date(Date.now() - windowMs)
  const filters = buildPublicBookFilters(genre, blockedAuthorIds)

  // Hot Books (paginated) mode: apply the multi-filter inputs so the candidate
  // set and totalCount reflect the user's filter selections. The `q` clause
  // inside `applyBookFilterInputs` references `userProfiles`, so we leftJoin
  // when filters are present.
  const hasFilterInputs = usePagination && !!args.filters
  if (hasFilterInputs) {
    applyBookFilterInputs(filters, args.filters!)
  }

  // Window cutoff: only enforce for legacy cursor mode. In pagination mode the
  // filter inputs (`updated`, `status`) already shape the recency window; an
  // additional 7d hard cutoff would erase results when filter inputs widen
  // the search.
  const whereClauses = usePagination
    ? and(...filters)
    : and(...filters, gte(books.updatedAt, windowStart))

  // Build candidates query — leftJoin userProfiles when filter inputs are
  // present (since `applyBookFilterInputs` references those columns for `q`).
  const candidatesSelect = {
    id: books.id,
    title: books.title,
    authorUserId: books.userId,
    coverUrl: books.coverUrl,
    synopsis: books.synopsis,
    genre: books.genre,
    tags: books.tags,
    updatedAt: books.updatedAt,
    firstPubliclyDiscoverableAt: books.firstPubliclyDiscoverableAt,
  }

  const candidatesPromise = hasFilterInputs
    ? db
        .select(candidatesSelect)
        .from(books)
        .leftJoin(userProfiles, eq(userProfiles.userId, books.userId))
        .where(whereClauses)
        .orderBy(desc(books.updatedAt), desc(books.id))
        .limit(200)
    : db
        .select(candidatesSelect)
        .from(books)
        .where(whereClauses)
        .orderBy(desc(books.updatedAt), desc(books.id))
        .limit(200)

  // Run candidate fetch + (paginated) total count in parallel.
  const totalCountPromise = usePagination
    ? hasFilterInputs
      ? db
          .select({ total: count(books.id) })
          .from(books)
          .leftJoin(userProfiles, eq(userProfiles.userId, books.userId))
          .where(whereClauses)
      : db
          .select({ total: count(books.id) })
          .from(books)
          .where(whereClauses)
    : Promise.resolve(null as { total: number | string }[] | null)

  const [candidatesRaw, totalCountRows] = await Promise.all([
    candidatesPromise,
    totalCountPromise,
  ])

  // De-dupe candidates (leftJoin can yield duplicates per row when the join
  // multiplies). Legacy path skips the join so this is a no-op there.
  const seen = new Set<string>()
  const candidates: typeof candidatesRaw = []
  for (const r of candidatesRaw) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    candidates.push(r)
  }

  const candidateIds = candidates.map((c) => c.id)
  // Issue #32: cumulative all-time counts + age decay (was: 7d-windowed signals).
  const counts = await loadCumulativeBookCounts(candidateIds)
  const now = Date.now()

  const scored = candidates.map((c) => {
    const cc = counts.get(c.id) ?? { likes: 0, comments: 0, bookmarks: 0 }
    const ref = c.firstPubliclyDiscoverableAt ?? c.updatedAt
    const hoursAgo = Math.max(0, (now - ref.getTime()) / 3_600_000)
    return {
      row: c,
      score: computeTrendingScore({
        likeCount: cc.likes,
        commentCount: cc.comments,
        bookmarkCount: cc.bookmarks,
        hoursAgo,
      }),
    }
  })
  // Sort: score DESC, updatedAt DESC, id DESC.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const at = a.row.updatedAt.getTime()
    const bt = b.row.updatedAt.getTime()
    if (bt !== at) return bt - at
    return b.row.id.localeCompare(a.row.id)
  })

  // Cursor: walk past rows with score > cursor.sortKey OR (score === cursor.sortKey AND id > cursor.id).
  // Only applied in legacy cursor mode.
  let filtered = scored
  if (!usePagination && cursor && typeof cursor.sortKey === 'number') {
    const sk: number = cursor.sortKey;
    filtered = scored.filter((s) => {
      if (s.score < sk) return true
      if (s.score === sk && s.row.id < cursor.id) return true
      return false
    })
  }

  const startIdx = usePagination ? offset : 0
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE_BOOKS)
  const strictRaw = pageRows.map((p) => p.row)
  const last = pageRows[pageRows.length - 1]
  const hasMore = filtered.length > startIdx + PAGE_SIZE_BOOKS
  const nextCursor =
    hasMore && last && !usePagination
      ? encodeCursor({ sortKey: last.score, id: last.row.id })
      : null

  // Pagination mode skips the rail backfill (offset semantics don't blend
  // with "top up to 4 cards"). Numbered grids show fewer cards when filters
  // narrow the result set — that's the correct UX.
  if (usePagination) {
    const cards = await projectToBookCards(strictRaw)
    const totalCount = Number(totalCountRows?.[0]?.total ?? cards.length)
    return {
      success: true,
      data: {
        books: cards,
        strictCount: cards.length,
        nextCursor: null,
        totalCount,
      },
    }
  }

  // Legacy cursor mode — preserved behavior + railWithBackfill.
  const rail = await railWithBackfill(
    strictRaw,
    genre,
    blockedAuthorIds,
    nextCursor,
  )
  return {
    success: true,
    data: {
      ...rail,
      // No COUNT query runs in legacy mode; fall back to the candidate-window
      // size so callers that read `totalCount` still get a sensible non-zero.
      totalCount: scored.length,
    },
  }
}

// ─── 3. Rising Stars ──────────────────────────────────────────────────────────

export async function getRisingStarsBooksAction(args: {
  genre?: string
  cursor?: string | null
}): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blockedAuthorIds = await getBlockedAuthorIdsForViewer(viewerId)
  const genre =
    args.genre && isValidGenre(args.genre) ? (args.genre as GenreSlug) : undefined
  const cursor = decodeCursor(args.cursor)

  const windowStart = new Date(Date.now() - SEVEN_DAYS_MS)
  const filters = buildPublicBookFilters(genre, blockedAuthorIds)

  const candidates = await db
    .select({
      id: books.id,
      title: books.title,
      authorUserId: books.userId,
      coverUrl: books.coverUrl,
      synopsis: books.synopsis,
      genre: books.genre,
      tags: books.tags,
      updatedAt: books.updatedAt,
      firstPubliclyDiscoverableAt: books.firstPubliclyDiscoverableAt,
    })
    .from(books)
    .where(and(...filters, gte(books.updatedAt, windowStart)))
    .orderBy(desc(books.updatedAt), desc(books.id))
    .limit(200)

  const candidateIds = candidates.map((c) => c.id)

  const [signals, allTimeLikes] = await Promise.all([
    loadTrendingSignals(candidateIds, SEVEN_DAYS_MS),
    candidateIds.length === 0
      ? Promise.resolve(
          [] as Array<{ bookId: string; total: number | string }>,
        )
      : db
          .select({ bookId: bookLikes.bookId, total: count() })
          .from(bookLikes)
          .where(inArray(bookLikes.bookId, candidateIds))
          .groupBy(bookLikes.bookId),
  ])

  const allTimeMap = new Map(
    allTimeLikes.map((r) => [r.bookId, Number(r.total)]),
  )
  const now = Date.now()
  const scored = candidates.map((c) => {
    const s = signals.get(c.id) ?? {
      likes: 0,
      comments: 0,
      reads: 0,
      follows: 0,
    }
    const firstPub = c.firstPubliclyDiscoverableAt ?? c.updatedAt
    const ageDays = (now - firstPub.getTime()) / 86_400_000
    const hoursAgo = Math.max(0, (now - firstPub.getTime()) / 3_600_000)
    // Issue #32: RisingStarsInputs now extends TrendingInputs (likeCount/commentCount/
    // bookmarkCount/hoursAgo). 7d signal counts feed the engagement slots — follows/reads
    // get folded into bookmarkCount as a third signal channel to preserve their influence.
    return {
      row: c,
      score: computeRisingStarsScore({
        likeCount: s.likes,
        commentCount: s.comments,
        bookmarkCount: s.reads + s.follows,
        hoursAgo,
        totalLikesAllTime: allTimeMap.get(c.id) ?? 0,
        ageDays,
      }),
    }
  })
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const aFirst = (a.row.firstPubliclyDiscoverableAt ?? a.row.updatedAt).getTime()
    const bFirst = (b.row.firstPubliclyDiscoverableAt ?? b.row.updatedAt).getTime()
    if (bFirst !== aFirst) return bFirst - aFirst
    return b.row.id.localeCompare(a.row.id)
  })

  let filtered = scored
  if (cursor && typeof cursor.sortKey === 'number') {
    const sk: number = cursor.sortKey;
    filtered = scored.filter((s) => {
      if (s.score < sk) return true
      if (s.score === sk && s.row.id < cursor.id) return true
      return false
    })
  }

  const pageRows = filtered.slice(0, PAGE_SIZE_BOOKS)
  const strictRaw = pageRows.map((p) => p.row)
  const last = pageRows[pageRows.length - 1]
  const hasMore = filtered.length > PAGE_SIZE_BOOKS
  const nextCursor =
    hasMore && last
      ? encodeCursor({ sortKey: last.score, id: last.row.id })
      : null

  return {
    success: true,
    data: await railWithBackfill(strictRaw, genre, blockedAuthorIds, nextCursor),
  }
}

// ─── 4. Recently Updated ──────────────────────────────────────────────────────

export async function getRecentlyUpdatedBooksAction(args: {
  genre?: string
  cursor?: string | null
  window?: '7d' | '30d'
}): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blockedAuthorIds = await getBlockedAuthorIdsForViewer(viewerId)
  const genre =
    args.genre && isValidGenre(args.genre) ? (args.genre as GenreSlug) : undefined
  const windowMs = args.window === '30d' ? THIRTY_DAYS_MS : SEVEN_DAYS_MS
  const cursor = decodeCursor(args.cursor)

  const windowStart = new Date(Date.now() - windowMs)
  const lastUpdateRows = await db
    .select({
      bookId: chapters.bookId,
      last: sql<Date>`MAX(${chapters.updatedAt})`,
    })
    .from(chapters)
    .where(
      and(
        inArray(chapters.status, ['REVISED', 'FINAL']),
        gte(chapters.updatedAt, windowStart),
      ),
    )
    .groupBy(chapters.bookId)
    .orderBy(desc(sql`MAX(${chapters.updatedAt})`))
    .limit(200)

  if (lastUpdateRows.length === 0) {
    return {
      success: true,
      data: await railWithBackfill([], genre, blockedAuthorIds, null),
    }
  }

  const candidateIds = lastUpdateRows.map((r) => r.bookId)
  const filters = buildPublicBookFilters(genre, blockedAuthorIds)
  filters.push(inArray(books.id, candidateIds))

  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      authorUserId: books.userId,
      coverUrl: books.coverUrl,
      synopsis: books.synopsis,
      genre: books.genre,
      tags: books.tags,
      updatedAt: books.updatedAt,
      firstPubliclyDiscoverableAt: books.firstPubliclyDiscoverableAt,
    })
    .from(books)
    .where(and(...filters))

  const lastMap = new Map(
    lastUpdateRows.map((r) => [r.bookId, r.last as Date]),
  )
  const sorted = rows
    .filter((r) => lastMap.has(r.id))
    .sort((a, b) => {
      const al = lastMap.get(a.id)!.getTime()
      const bl = lastMap.get(b.id)!.getTime()
      if (bl !== al) return bl - al
      return b.id.localeCompare(a.id)
    })

  let filtered = sorted
  if (cursor && typeof cursor.sortKey === 'number') {
    const sk: number = cursor.sortKey;
    filtered = sorted.filter((r) => {
      const last = lastMap.get(r.id)!.getTime()
      if (last < sk) return true
      if (last === sk && r.id < cursor.id) return true
      return false
    })
  }

  const pageRows = filtered.slice(0, PAGE_SIZE_BOOKS)
  const lastRow = pageRows[pageRows.length - 1]
  const hasMore = filtered.length > PAGE_SIZE_BOOKS
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor({
          sortKey: lastMap.get(lastRow.id)!.getTime(),
          id: lastRow.id,
        })
      : null

  return {
    success: true,
    data: await railWithBackfill(pageRows, genre, blockedAuthorIds, nextCursor),
  }
}

// ─── 5. New Releases ──────────────────────────────────────────────────────────

export async function getNewReleasesBooksAction(args: {
  genre?: string
  cursor?: string | null
}): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blockedAuthorIds = await getBlockedAuthorIdsForViewer(viewerId)
  const genre =
    args.genre && isValidGenre(args.genre) ? (args.genre as GenreSlug) : undefined
  const cursor = decodeCursor(args.cursor)

  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS)
  const filters = buildPublicBookFilters(genre, blockedAuthorIds)
  filters.push(gte(books.firstPubliclyDiscoverableAt, thirtyDaysAgo))

  if (cursor && typeof cursor.sortKey === 'number') {
    const sk: number = cursor.sortKey;
    const cursorDate = new Date(sk)
    filters.push(
      or(
        lt(books.firstPubliclyDiscoverableAt, cursorDate),
        and(
          eq(books.firstPubliclyDiscoverableAt, cursorDate),
          lt(books.id, cursor.id),
        ),
      )!,
    )
  }

  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      authorUserId: books.userId,
      coverUrl: books.coverUrl,
      synopsis: books.synopsis,
      genre: books.genre,
      tags: books.tags,
      updatedAt: books.updatedAt,
      firstPubliclyDiscoverableAt: books.firstPubliclyDiscoverableAt,
    })
    .from(books)
    .where(and(...filters))
    .orderBy(desc(books.firstPubliclyDiscoverableAt), desc(books.id))
    .limit(PAGE_SIZE_BOOKS + 1)

  const hasMore = rows.length > PAGE_SIZE_BOOKS
  const pageRows = rows.slice(0, PAGE_SIZE_BOOKS)
  const last = pageRows[pageRows.length - 1]
  const nextCursor =
    hasMore && last && last.firstPubliclyDiscoverableAt
      ? encodeCursor({
          sortKey: last.firstPubliclyDiscoverableAt.getTime(),
          id: last.id,
        })
      : null

  return {
    success: true,
    data: await railWithBackfill(pageRows, genre, blockedAuthorIds, nextCursor),
  }
}

// ─── 6. Best Ongoing ──────────────────────────────────────────────────────────

const getBestOngoingMedian = unstable_cache(
  async (): Promise<number> => {
    // Build "currently active" book set = at least one chapter REVISED/FINAL
    // updated in the last 30 days. Sum (likes + comments + author follower
    // count) per book and return the median.
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS)
    const activeBookRows = await db
      .selectDistinct({ bookId: chapters.bookId })
      .from(chapters)
      .where(
        and(
          inArray(chapters.status, ['REVISED', 'FINAL']),
          gte(chapters.updatedAt, thirtyDaysAgo),
        ),
      )
    if (activeBookRows.length === 0) return 0
    const ids = activeBookRows.map((r) => r.bookId)

    const [likeRows, commentRows, authorRows] = await Promise.all([
      db
        .select({ bookId: bookLikes.bookId, total: count() })
        .from(bookLikes)
        .where(inArray(bookLikes.bookId, ids))
        .groupBy(bookLikes.bookId),
      db
        .select({ bookId: bookComments.bookId, total: count() })
        .from(bookComments)
        .where(inArray(bookComments.bookId, ids))
        .groupBy(bookComments.bookId),
      db
        .select({ bookId: books.id, authorUserId: books.userId })
        .from(books)
        .where(inArray(books.id, ids)),
    ])

    const authorMap = new Map(authorRows.map((r) => [r.bookId, r.authorUserId]))
    const authorIds = Array.from(new Set(authorMap.values()))
    const followerRows =
      authorIds.length === 0
        ? []
        : await db
            .select({ followeeId: follows.followeeId, total: count() })
            .from(follows)
            .where(inArray(follows.followeeId, authorIds))
            .groupBy(follows.followeeId)
    const followerMap = new Map(
      followerRows.map((r) => [r.followeeId, Number(r.total)]),
    )

    const likeMap = new Map(likeRows.map((r) => [r.bookId, Number(r.total)]))
    const commentMap = new Map(
      commentRows.map((r) => [r.bookId, Number(r.total)]),
    )

    const scores = ids.map((id) => {
      const l = likeMap.get(id) ?? 0
      const c = commentMap.get(id) ?? 0
      const author = authorMap.get(id)
      const f = author ? followerMap.get(author) ?? 0 : 0
      return l + c + f
    })
    scores.sort((a, b) => a - b)
    const mid = Math.floor(scores.length / 2)
    return scores.length % 2 === 0
      ? (scores[mid - 1] + scores[mid]) / 2
      : scores[mid]
  },
  ['discover-best-ongoing-median'],
  { revalidate: 300 },
)

export async function getBestOngoingBooksAction(args: {
  genre?: string
  cursor?: string | null
}): Promise<ActionResult<RailResult>> {
  const viewerId = await getOptionalUserId()
  const blockedAuthorIds = await getBlockedAuthorIdsForViewer(viewerId)
  const genre =
    args.genre && isValidGenre(args.genre) ? (args.genre as GenreSlug) : undefined
  const cursor = decodeCursor(args.cursor)

  const median = await getBestOngoingMedian()
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS)

  // Active books = ones with a REVISED/FINAL chapter touched in last 30d.
  const activeRows = await db
    .selectDistinct({ bookId: chapters.bookId })
    .from(chapters)
    .where(
      and(
        inArray(chapters.status, ['REVISED', 'FINAL']),
        gte(chapters.updatedAt, thirtyDaysAgo),
      ),
    )

  if (activeRows.length === 0) {
    return {
      success: true,
      data: await railWithBackfill([], genre, blockedAuthorIds, null),
    }
  }

  const activeIds = activeRows.map((r) => r.bookId)
  const filters = buildPublicBookFilters(genre, blockedAuthorIds)
  filters.push(inArray(books.id, activeIds))

  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      authorUserId: books.userId,
      coverUrl: books.coverUrl,
      synopsis: books.synopsis,
      genre: books.genre,
      tags: books.tags,
      updatedAt: books.updatedAt,
      firstPubliclyDiscoverableAt: books.firstPubliclyDiscoverableAt,
    })
    .from(books)
    .where(and(...filters))

  const ids = rows.map((r) => r.id)
  const [likeRows, commentRows] = await Promise.all([
    ids.length === 0
      ? Promise.resolve([] as Array<{ bookId: string; total: number | string }>)
      : db
          .select({ bookId: bookLikes.bookId, total: count() })
          .from(bookLikes)
          .where(inArray(bookLikes.bookId, ids))
          .groupBy(bookLikes.bookId),
    ids.length === 0
      ? Promise.resolve([] as Array<{ bookId: string; total: number | string }>)
      : db
          .select({ bookId: bookComments.bookId, total: count() })
          .from(bookComments)
          .where(inArray(bookComments.bookId, ids))
          .groupBy(bookComments.bookId),
  ])
  const likeMap = new Map(likeRows.map((r) => [r.bookId, Number(r.total)]))
  const commentMap = new Map(
    commentRows.map((r) => [r.bookId, Number(r.total)]),
  )

  const scored = rows
    .map((r) => ({
      row: r,
      engagement: (likeMap.get(r.id) ?? 0) + (commentMap.get(r.id) ?? 0),
    }))
    .filter((s) => s.engagement >= median)
    .sort((a, b) => {
      if (b.engagement !== a.engagement) return b.engagement - a.engagement
      return b.row.id.localeCompare(a.row.id)
    })

  let filtered = scored
  if (cursor && typeof cursor.sortKey === 'number') {
    const sk: number = cursor.sortKey;
    filtered = scored.filter((s) => {
      if (s.engagement < sk) return true
      if (s.engagement === sk && s.row.id < cursor.id) return true
      return false
    })
  }

  const pageRows = filtered.slice(0, PAGE_SIZE_BOOKS)
  const strictRaw = pageRows.map((p) => p.row)
  const last = pageRows[pageRows.length - 1]
  const hasMore = filtered.length > PAGE_SIZE_BOOKS
  const nextCursor =
    hasMore && last
      ? encodeCursor({ sortKey: last.engagement, id: last.row.id })
      : null

  return {
    success: true,
    data: await railWithBackfill(strictRaw, genre, blockedAuthorIds, nextCursor),
  }
}

// ─── 7. From Authors You Follow ───────────────────────────────────────────────
//
// Guest behavior: this action calls `requireAuth()`, which throws `AuthError`
// for guests. Callers (the Books home page orchestrator) wrap in `.catch()` so
// a guest visit doesn't crash the page; the surface simply hides the rail.

export async function getFollowingFeedAction(args: {
  genre?: string
  cursor?: string | null
}): Promise<ActionResult<RailResult>> {
  const viewerId = await requireAuth()
  const blockedAuthorIds = await getBlockedAuthorIdsForViewer(viewerId)
  const genre =
    args.genre && isValidGenre(args.genre) ? (args.genre as GenreSlug) : undefined
  const cursor = decodeCursor(args.cursor)

  // Followee ids.
  const followeeRows = await db
    .select({ id: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, viewerId))
  if (followeeRows.length === 0) {
    return {
      success: true,
      data: { books: [], strictCount: 0, nextCursor: null },
    }
  }
  const followeeIds = followeeRows.map((r) => r.id)

  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS)

  // Books authored by followees + chapter activity in window.
  const lastUpdateRows = await db
    .select({
      bookId: chapters.bookId,
      last: sql<Date>`MAX(${chapters.updatedAt})`,
    })
    .from(chapters)
    .innerJoin(books, eq(chapters.bookId, books.id))
    .where(
      and(
        inArray(books.userId, followeeIds),
        inArray(chapters.status, ['REVISED', 'FINAL']),
        gte(chapters.updatedAt, thirtyDaysAgo),
      ),
    )
    .groupBy(chapters.bookId)
    .orderBy(desc(sql`MAX(${chapters.updatedAt})`))
    .limit(200)

  if (lastUpdateRows.length === 0) {
    return {
      success: true,
      data: { books: [], strictCount: 0, nextCursor: null },
    }
  }

  const candidateIds = lastUpdateRows.map((r) => r.bookId)
  const filters = buildPublicBookFilters(genre, blockedAuthorIds)
  filters.push(inArray(books.id, candidateIds))

  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      authorUserId: books.userId,
      coverUrl: books.coverUrl,
      synopsis: books.synopsis,
      genre: books.genre,
      tags: books.tags,
      updatedAt: books.updatedAt,
      firstPubliclyDiscoverableAt: books.firstPubliclyDiscoverableAt,
    })
    .from(books)
    .where(and(...filters))

  const lastMap = new Map(
    lastUpdateRows.map((r) => [r.bookId, r.last as Date]),
  )
  const sorted = rows
    .filter((r) => lastMap.has(r.id))
    .sort((a, b) => {
      const al = lastMap.get(a.id)!.getTime()
      const bl = lastMap.get(b.id)!.getTime()
      if (bl !== al) return bl - al
      return b.id.localeCompare(a.id)
    })

  let filtered = sorted
  if (cursor && typeof cursor.sortKey === 'number') {
    const sk: number = cursor.sortKey;
    filtered = sorted.filter((r) => {
      const last = lastMap.get(r.id)!.getTime()
      if (last < sk) return true
      if (last === sk && r.id < cursor.id) return true
      return false
    })
  }

  const pageRows = filtered.slice(0, PAGE_SIZE_BOOKS)
  const lastRow = pageRows[pageRows.length - 1]
  const hasMore = filtered.length > PAGE_SIZE_BOOKS
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor({
          sortKey: lastMap.get(lastRow.id)!.getTime(),
          id: lastRow.id,
        })
      : null

  // NOTE: Following rail does NOT backfill. strictCount === books.length.
  const cards = await projectToBookCards(pageRows)
  return {
    success: true,
    data: { books: cards, strictCount: cards.length, nextCursor },
  }
}

// ─── 8. Backfill helper (public) ──────────────────────────────────────────────

export async function getBackfillBooksAction(args: {
  excludeIds: string[]
  genre?: string
  limit?: number
}): Promise<ActionResult<BookCard[]>> {
  const viewerId = await getOptionalUserId()
  const blockedAuthorIds = await getBlockedAuthorIdsForViewer(viewerId)
  const genre =
    args.genre && isValidGenre(args.genre) ? (args.genre as GenreSlug) : undefined
  const limit = args.limit ?? 4

  const rows = await getRecentlyUpdatedRowsInternal(
    genre,
    args.excludeIds,
    blockedAuthorIds,
    limit,
    THIRTY_DAYS_MS,
  )
  const cards = await projectToBookCards(rows)
  return { success: true, data: cards }
}

// ─── 9. Search (Discover) ─────────────────────────────────────────────────────

export async function searchBooksDiscoverAction(args: {
  q?: string
  genre?: string
  /** Multi-select genre — when non-empty, takes precedence over single `genre`. */
  genres?: string[]
  tag?: string
  /** Word-count bucket. Applied via correlated subquery over chapters.word_count. */
  length?: 'any' | 'short' | 'novella' | 'novel' | 'epic'
  /** Status bucket derived from updated_at (Ongoing = updated within 90d). */
  status?: 'any' | 'ongoing' | 'completed'
  series?: 'any' | 'standalone' | 'in-series'
  updated?: 'anytime' | 'week' | 'month'
  sort?: 'relevance' | 'recent' | 'popular'
  cursor?: string | null
  /** 1-indexed page number for numbered pagination. When set, overrides cursor. */
  page?: number
}): Promise<
  ActionResult<{
    books: BookCard[]
    nextCursor: string | null
    totalCount: number
  }>
> {
  const viewerId = await getOptionalUserId()
  const blockedAuthorIds = await getBlockedAuthorIdsForViewer(viewerId)
  const cursor = decodeCursor(args.cursor)
  const page = Math.max(1, Math.floor(args.page ?? 1))
  const usePagination = (args.page ?? 0) > 0
  const offset = (page - 1) * PAGE_SIZE_BOOKS

  const q = (args.q ?? '').trim()

  // 'relevance' currently maps to 'recent' until a real relevance signal lands.
  // TODO: real relevance scoring (per spec §9 — out of scope for D1).
  const sort: 'recent' | 'popular' =
    args.sort === 'popular' ? 'popular' : 'recent'

  // Build base filter set — start with public + discoverable + non-blocked.
  // Apply single-genre via the existing helper unless `genres` (plural) is supplied.
  const multiGenres = (args.genres ?? [])
    .filter((g): g is string => typeof g === 'string' && isValidGenre(g))
  const singleGenre =
    !multiGenres.length && args.genre && isValidGenre(args.genre)
      ? (args.genre as GenreSlug)
      : undefined
  const filters = buildPublicBookFilters(singleGenre, blockedAuthorIds)

  // Push WHERE clauses for q / genres / length / status / series / updated.
  applyBookFilterInputs(filters, {
    q: args.q,
    genres: args.genres,
    length: args.length,
    status: args.status,
    series: args.series,
    updated: args.updated,
  })

  // Standalone `tag` filter remains inline (not part of FilterInputs).
  if (args.tag) {
    filters.push(sql`${args.tag} = ANY(${books.tags})`)
  }

  // Fetch a candidate window + total count in parallel. The COUNT query
  // backs numbered pagination's totalPages math; the 200-candidate cap
  // means very large unfiltered queries can show more cards than the
  // candidate window — that's a known v1 limitation (spec deferred).
  const [rows, totalCountRows] = await Promise.all([
    db
      .select({
        id: books.id,
        title: books.title,
        authorUserId: books.userId,
        coverUrl: books.coverUrl,
        synopsis: books.synopsis,
        genre: books.genre,
        tags: books.tags,
        updatedAt: books.updatedAt,
        firstPubliclyDiscoverableAt: books.firstPubliclyDiscoverableAt,
      })
      .from(books)
      .leftJoin(userProfiles, eq(userProfiles.userId, books.userId))
      .where(and(...filters))
      .limit(200),
    db
      .select({ total: count(books.id) })
      .from(books)
      .leftJoin(userProfiles, eq(userProfiles.userId, books.userId))
      .where(and(...filters)),
  ])
  const totalCount = Number(totalCountRows[0]?.total ?? 0)

  // De-dupe (the JOIN can produce duplicates if a book has multiple matches).
  const seen = new Set<string>()
  const unique: typeof rows = []
  for (const r of rows) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    unique.push(r)
  }

  let sorted: typeof rows
  if (sort === 'popular') {
    const ids = unique.map((r) => r.id)
    const likeRows =
      ids.length === 0
        ? []
        : await db
            .select({ bookId: bookLikes.bookId, total: count() })
            .from(bookLikes)
            .where(inArray(bookLikes.bookId, ids))
            .groupBy(bookLikes.bookId)
    const likeMap = new Map(likeRows.map((r) => [r.bookId, Number(r.total)]))
    sorted = [...unique].sort((a, b) => {
      const al = likeMap.get(a.id) ?? 0
      const bl = likeMap.get(b.id) ?? 0
      if (bl !== al) return bl - al
      return b.id.localeCompare(a.id)
    })
    if (!usePagination && cursor && typeof cursor.sortKey === 'number') {
    const sk: number = cursor.sortKey;
      sorted = sorted.filter((r) => {
        const lc = likeMap.get(r.id) ?? 0
        if (lc < sk) return true
        if (lc === sk && r.id < cursor.id) return true
        return false
      })
    }
    const startIdx = usePagination ? offset : 0
    const pageRows = sorted.slice(startIdx, startIdx + PAGE_SIZE_BOOKS)
    const last = pageRows[pageRows.length - 1]
    const hasMore = sorted.length > startIdx + PAGE_SIZE_BOOKS
    const nextCursor =
      hasMore && last && !usePagination
        ? encodeCursor({
            sortKey: likeMap.get(last.id) ?? 0,
            id: last.id,
          })
        : null
    const cards = await projectToBookCards(pageRows)
    return { success: true, data: { books: cards, nextCursor, totalCount } }
  }

  // 'recent' sort.
  sorted = [...unique].sort((a, b) => {
    const at = a.updatedAt.getTime()
    const bt = b.updatedAt.getTime()
    if (bt !== at) return bt - at
    return b.id.localeCompare(a.id)
  })
  if (!usePagination && cursor && typeof cursor.sortKey === 'number') {
    const sk: number = cursor.sortKey;
    sorted = sorted.filter((r) => {
      const t = r.updatedAt.getTime()
      if (t < sk) return true
      if (t === sk && r.id < cursor.id) return true
      return false
    })
  }
  const startIdx = usePagination ? offset : 0
  const pageRows = sorted.slice(startIdx, startIdx + PAGE_SIZE_BOOKS)
  const last = pageRows[pageRows.length - 1]
  const hasMore = sorted.length > startIdx + PAGE_SIZE_BOOKS
  const nextCursor =
    hasMore && last && !usePagination
      ? encodeCursor({ sortKey: last.updatedAt.getTime(), id: last.id })
      : null
  const cards = await projectToBookCards(pageRows)
  return { success: true, data: { books: cards, nextCursor, totalCount } }
}

// ─── 10. Genre book counts (cached 5min) ──────────────────────────────────────

const getGenreBookCountsCached = unstable_cache(
  async (): Promise<Record<GenreSlug, number>> => {
    const rows = await db
      .select({ genre: books.genre, total: count() })
      .from(books)
      .where(
        and(
          eq(books.visibility, 'PUBLIC'),
          eq(books.discoverable, true),
          ne(books.status, 'STANDALONE_HIVE_SHADOW'),
        ),
      )
      .groupBy(books.genre)

    const counts: Record<GenreSlug, number> = GENRES.reduce(
      (acc, slug) => {
        acc[slug] = 0
        return acc
      },
      {} as Record<GenreSlug, number>,
    )
    for (const r of rows) {
      const slug = normalizeGenre(r.genre)
      counts[slug] += Number(r.total)
    }
    return counts
  },
  ['discover-genre-counts'],
  { revalidate: 300, tags: ['discover-genre-counts'] },
)

export async function getGenreBookCountsAction(): Promise<
  ActionResult<Record<GenreSlug, number>>
> {
  const data = await getGenreBookCountsCached()
  return { success: true, data }
}

// ─── Legacy preserved exports ─────────────────────────────────────────────────
// These predate D1 and are still consumed by the public book reader page and
// AddBookModal in /reading-lists and /clubs. The new D1 surface uses BookCard /
// RailResult instead.

/**
 * Returns the book data for the reader page. Does NOT gate by privacy.
 * Callers must gate access with `canReadBook()` before rendering.
 */
export async function getPublicBookAction(
  bookId: string,
): Promise<ActionResult<PublicBook>> {
  const [row] = await db
    .select({
      id: books.id,
      title: books.title,
      genre: books.genre,
      coverUrl: books.coverUrl,
      synopsis: books.synopsis,
      tags: books.tags,
      updatedAt: books.updatedAt,
      authorUserId: userProfiles.userId,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
      authorAvatarUrl: userProfiles.avatarUrl,
      seriesName: books.seriesName,
      seriesNumber: books.seriesNumber,
    })
    .from(books)
    .innerJoin(userProfiles, eq(books.userId, userProfiles.userId))
    .where(eq(books.id, bookId))
    .limit(1)

  if (!row) return { success: false, error: 'NOT_FOUND' }

  const [likeCount, bookmarkCount, wordCountResult, chapterCountResult] =
    await Promise.all([
      db.select({ total: count() }).from(bookLikes).where(eq(bookLikes.bookId, bookId)),
      db.select({ total: count() }).from(bookmarks).where(eq(bookmarks.bookId, bookId)),
      db
        .select({ total: sql<number>`COALESCE(SUM(${chapters.wordCount}), 0)` })
        .from(chapters)
        .where(eq(chapters.bookId, bookId)),
      db
        .select({ total: count() })
        .from(binderItems)
        .where(
          and(eq(binderItems.bookId, bookId), eq(binderItems.type, 'chapter')),
        ),
    ])

  return {
    success: true,
    data: {
      ...row,
      authorUsername: row.authorUsername,
      likeCount: likeCount[0]?.total ?? 0,
      bookmarkCount: bookmarkCount[0]?.total ?? 0,
      wordCount: wordCountResult[0]?.total ?? 0,
      chapterCount: chapterCountResult[0]?.total ?? 0,
    },
  }
}

const COMMENTS_PAGE_SIZE = 20

export async function getBookCommentsAction(
  bookId: string,
  page: number = 1,
): Promise<ActionResult<{ comments: BookComment[]; hasMore: boolean }>> {
  const userId = await getOptionalUserId()
  const access = await canReadBook(bookId, userId)
  if (!access.ok) return { success: false, error: 'FORBIDDEN' }

  const offset = (page - 1) * COMMENTS_PAGE_SIZE

  const rows = await db
    .select({
      id: bookComments.id,
      content: bookComments.content,
      createdAt: bookComments.createdAt,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
      authorAvatarUrl: userProfiles.avatarUrl,
    })
    .from(bookComments)
    .innerJoin(userProfiles, eq(bookComments.userId, userProfiles.userId))
    .where(and(eq(bookComments.bookId, bookId), isNull(bookComments.parentId)))
    .orderBy(desc(bookComments.createdAt))
    .limit(COMMENTS_PAGE_SIZE + 1)
    .offset(offset)

  const hasMore = rows.length > COMMENTS_PAGE_SIZE

  return {
    success: true,
    data: { comments: rows.slice(0, COMMENTS_PAGE_SIZE), hasMore },
  }
}

export type MoreByAuthorBook = {
  id: string
  title: string
  authorUsername: string | null
  authorDisplayName: string | null
}

export async function getMoreByAuthorAction(
  authorUserId: string,
  excludeBookId: string,
): Promise<ActionResult<MoreByAuthorBook | null>> {
  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
    })
    .from(books)
    .leftJoin(userProfiles, eq(books.userId, userProfiles.userId))
    .where(
      and(
        eq(books.userId, authorUserId),
        sql`${books.id} <> ${excludeBookId}`,
        eq(books.visibility, 'PUBLIC'),
        eq(books.discoverable, true),
      ),
    )
    .orderBy(desc(books.updatedAt))
    .limit(1)

  return { success: true, data: rows[0] ?? null }
}

export type SearchBookHit = {
  bookId: string
  title: string
  author: string
  coverUrl: string | null
}

/**
 * C3 T7: search public+discoverable books by title or author display name,
 * filtered through bidirectional `isBlocked` on author. Used by AddBookModal's
 * Beehive search tab. Distinct from D1's `searchBooksDiscoverAction`.
 */
export async function searchBooksAction(
  input: unknown,
): Promise<ActionResult<{ rows: SearchBookHit[] }>> {
  const viewerId = await getOptionalUserId()
  const parsed = searchBooksSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }
  const limit = parsed.data.limit ?? 10
  const q = `%${parsed.data.query}%`

  const rows = await db
    .select({
      bookId: books.id,
      title: books.title,
      coverUrl: books.coverUrl,
      authorUserId: books.userId,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
    })
    .from(books)
    .leftJoin(userProfiles, eq(userProfiles.userId, books.userId))
    .where(
      and(
        eq(books.visibility, 'PUBLIC'),
        eq(books.discoverable, true),
        or(ilike(books.title, q), ilike(userProfiles.displayName, q)),
      ),
    )
    .limit(limit * 2)

  const filtered: SearchBookHit[] = []
  for (const r of rows) {
    if (viewerId && (await isBlocked(viewerId, r.authorUserId))) continue
    filtered.push({
      bookId: r.bookId,
      title: r.title,
      author: r.authorDisplayName ?? r.authorUsername ?? 'Unknown author',
      coverUrl: r.coverUrl,
    })
    if (filtered.length >= limit) break
  }

  return { success: true, data: { rows: filtered } }
}
