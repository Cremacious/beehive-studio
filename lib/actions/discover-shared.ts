/**
 * Shared (non-'use server') helpers + types for Discover book actions.
 *
 * Lives outside `discover.actions.ts` so that non-async exports (constants,
 * sync helpers, types) don't violate Next.js's `'use server'` rule that every
 * export from a server-action module must be an async function. Server-action
 * modules import from here freely.
 */

import { cache } from 'react'
import { db } from '@/db'
import {
  books,
  binderItems,
  chapters,
  bookLikes,
  bookComments,
} from '@/db/schema'
import { userProfiles } from '@/db/schema'
import { userBlocks, follows, chapterReads } from '@/db/schema/social'
import { computeTrendingScore } from '@/lib/discover/scoring'
import {
  and,
  eq,
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
  type SQL,
} from 'drizzle-orm'
import {
  normalizeGenre,
  isValidGenre,
  type GenreSlug,
} from '@/lib/discover/genres'

// ─── Public types ─────────────────────────────────────────────────────────────

export type BookCard = {
  id: string
  title: string
  authorUserId: string
  authorUsername: string | null
  authorDisplayName: string | null
  authorAvatarUrl: string | null
  coverUrl: string | null
  synopsis: string | null
  genre: GenreSlug
  tags: string[]
  likeCount: number
  chapterCount: number
  lastUpdatedAt: Date | null
  isRecentlyActive: boolean
}

export type RawBookRow = {
  id: string
  title: string
  authorUserId: string
  coverUrl: string | null
  synopsis: string | null
  genre: string | null
  tags: string[] | null
  updatedAt: Date
  firstPubliclyDiscoverableAt: Date | null
}

export type FilterInputs = {
  q?: string
  genres?: string[]
  length?: 'any' | 'short' | 'novella' | 'novel' | 'epic'
  status?: 'any' | 'ongoing' | 'completed'
  series?: 'any' | 'standalone' | 'in-series'
  updated?: 'anytime' | 'week' | 'month'
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAGE_SIZE_BOOKS = 12

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves the bidirectional blocked-author set for a viewer in a single query.
 * Empty Set for guests. Used by every rail action so blocked authors' books
 * never leak into Discover.
 *
 * Issue #37: wrapped in React cache() for per-request dedup. The discover home
 * tab (and books tab) call this several times per render (featured + trending +
 * popular + for-you each resolve the same set), so memoizing by viewerId
 * collapses N identical queries to one per request. (Stays React cache(), not
 * Upstash: it returns a Set, which doesn't JSON-serialize.)
 */
export const getBlockedAuthorIdsForViewer = cache(async (
  viewerId: string | null,
): Promise<Set<string>> => {
  if (!viewerId) return new Set()
  const rows = await db
    .select({
      blockerId: userBlocks.blockerId,
      blockedId: userBlocks.blockedId,
    })
    .from(userBlocks)
    .where(
      or(
        eq(userBlocks.blockerId, viewerId),
        eq(userBlocks.blockedId, viewerId),
      ),
    )
  const set = new Set<string>()
  for (const r of rows) {
    if (r.blockerId === viewerId) set.add(r.blockedId)
    else set.add(r.blockerId)
  }
  return set
})

/**
 * Builds the canonical WHERE filter for any public+discoverable book lookup.
 * Genre is optional; blocked-author set excludes when non-empty.
 */
export function buildPublicBookFilters(
  genre: GenreSlug | undefined,
  blockedAuthorIds: Set<string>,
): SQL[] {
  const filters: SQL[] = [
    eq(books.visibility, 'PUBLIC'),
    eq(books.discoverable, true),
    ne(books.status, 'STANDALONE_HIVE_SHADOW'),
  ]
  if (genre) {
    filters.push(eq(books.genre, genre))
  }
  if (blockedAuthorIds.size > 0) {
    filters.push(notInArray(books.userId, Array.from(blockedAuthorIds)))
  }
  return filters
}

/**
 * Mutates `filters` in place by pushing WHERE clauses for the optional
 * filter inputs (`q`, `genres`, `length`, `status`, `series`, `updated`).
 * Extracted from `searchBooksDiscoverAction` so other actions (Hot, Popular,
 * etc.) can apply the same filter semantics without re-implementing them.
 *
 * NOTE on `q`: the title/author search clause references `userProfiles`
 * columns. Callers that pass `q` MUST `leftJoin(userProfiles, ...)` on their
 * query, otherwise the SQL will fail.
 */
export function applyBookFilterInputs(
  filters: SQL[],
  input: FilterInputs,
): void {
  const q = (input.q ?? '').trim()

  if (input.genres && input.genres.length > 0) {
    const multiGenres = input.genres.filter(
      (g): g is string => typeof g === 'string' && isValidGenre(g),
    )
    if (multiGenres.length > 0) {
      filters.push(inArray(books.genre, multiGenres as GenreSlug[]))
    }
  }

  // Title / author / tag search clause — only when q is non-empty.
  if (q.length > 0) {
    const like = `%${q}%`
    filters.push(
      or(
        ilike(books.title, like),
        ilike(userProfiles.displayName, like),
        ilike(userProfiles.username, like),
        sql`${q} = ANY(${books.tags})`,
      )!,
    )
  }

  // Length bucket via correlated subquery (chapters table has wordCount; books
  // does not). Trade-off: per-row subquery cost is real at scale; if hot,
  // denormalize books.aggregate_word_count later. Spec §11 deferred follow-up.
  if (input.length && input.length !== 'any') {
    const wcSql = sql<number>`COALESCE((SELECT SUM(${chapters.wordCount}) FROM ${chapters} WHERE ${chapters.bookId} = ${books.id}), 0)`
    if (input.length === 'short') filters.push(sql`${wcSql} < 20000`)
    else if (input.length === 'novella')
      filters.push(sql`${wcSql} >= 20000 AND ${wcSql} < 50000`)
    else if (input.length === 'novel')
      filters.push(sql`${wcSql} >= 50000 AND ${wcSql} < 120000`)
    else if (input.length === 'epic') filters.push(sql`${wcSql} >= 120000`)
  }

  // Status bucket — 90-day updated_at heuristic per plan resolved decision 1.
  if (input.status && input.status !== 'any') {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    if (input.status === 'ongoing')
      filters.push(gte(books.updatedAt, ninetyDaysAgo))
    else if (input.status === 'completed')
      filters.push(lt(books.updatedAt, ninetyDaysAgo))
  }

  // Series posture.
  if (input.series && input.series !== 'any') {
    if (input.series === 'standalone') filters.push(isNull(books.seriesName))
    else if (input.series === 'in-series')
      filters.push(sql`${books.seriesName} IS NOT NULL`)
  }

  // Updated recency bucket.
  if (input.updated && input.updated !== 'anytime') {
    const days = input.updated === 'week' ? 7 : 30
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    filters.push(gte(books.updatedAt, cutoff))
  }
}

/**
 * Projects a set of raw book rows to BookCard[] by joining authors + chapter
 * aggregates + last-update timestamps. All hydration runs in 3 parallel
 * queries stitched via Maps.
 */
export async function projectToBookCards(
  rows: RawBookRow[],
): Promise<BookCard[]> {
  if (rows.length === 0) return []
  const bookIds = rows.map((r) => r.id)
  const authorIds = Array.from(new Set(rows.map((r) => r.authorUserId)))

  const [authorRows, likeRows, chapterRows, lastUpdateRows] = await Promise.all([
    db
      .select({
        userId: userProfiles.userId,
        username: userProfiles.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, authorIds)),
    db
      .select({ bookId: bookLikes.bookId, total: count() })
      .from(bookLikes)
      .where(inArray(bookLikes.bookId, bookIds))
      .groupBy(bookLikes.bookId),
    db
      .select({ bookId: binderItems.bookId, total: count() })
      .from(binderItems)
      .where(
        and(
          inArray(binderItems.bookId, bookIds),
          eq(binderItems.type, 'chapter'),
        ),
      )
      .groupBy(binderItems.bookId),
    db
      .select({
        bookId: chapters.bookId,
        last: sql<Date>`MAX(${chapters.updatedAt})`,
      })
      .from(chapters)
      .where(
        and(
          inArray(chapters.bookId, bookIds),
          inArray(chapters.status, ['REVISED', 'FINAL']),
        ),
      )
      .groupBy(chapters.bookId),
  ])

  const authorMap = new Map(authorRows.map((r) => [r.userId, r]))
  const likeMap = new Map(likeRows.map((r) => [r.bookId, Number(r.total)]))
  const chapterMap = new Map(
    chapterRows.map((r) => [r.bookId, Number(r.total)]),
  )
  const lastUpdateMap = new Map(
    lastUpdateRows.map((r) => [r.bookId, r.last as Date | null]),
  )

  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS)

  return rows.map((r) => {
    const author = authorMap.get(r.authorUserId)
    const lastUpdated = lastUpdateMap.get(r.id) ?? null
    const isRecentlyActive =
      lastUpdated instanceof Date && lastUpdated >= thirtyDaysAgo
    return {
      id: r.id,
      title: r.title,
      authorUserId: r.authorUserId,
      authorUsername: author?.username ?? null,
      authorDisplayName: author?.displayName ?? null,
      authorAvatarUrl: author?.avatarUrl ?? null,
      coverUrl: r.coverUrl,
      synopsis: r.synopsis,
      genre: normalizeGenre(r.genre),
      tags: r.tags ?? [],
      likeCount: likeMap.get(r.id) ?? 0,
      chapterCount: chapterMap.get(r.id) ?? 0,
      lastUpdatedAt: lastUpdated,
      isRecentlyActive,
    }
  })
}

// ─── Trending signal loader + scorer ──────────────────────────────────────────

const SEVEN_DAYS_MS_SHARED = 7 * 24 * 60 * 60 * 1000

export type TrendingSignalCounts = {
  likes: number
  comments: number
  reads: number
  follows: number
}

/**
 * Loads the 4 trending signals over a window for a set of book ids.
 * Runs 4 GROUP BY queries in parallel and stitches into a Map keyed by bookId.
 * Follows are aggregated per book via `follows.followee_id = books.user_id`.
 */
export async function loadTrendingSignals(
  bookIds: string[],
  windowMs: number = SEVEN_DAYS_MS_SHARED,
): Promise<Map<string, TrendingSignalCounts>> {
  if (bookIds.length === 0) return new Map()
  const windowStart = new Date(Date.now() - windowMs)

  const [likeRows, commentRows, readRows, followRows] = await Promise.all([
    db
      .select({ bookId: bookLikes.bookId, total: count() })
      .from(bookLikes)
      .where(
        and(
          inArray(bookLikes.bookId, bookIds),
          gte(bookLikes.createdAt, windowStart),
        ),
      )
      .groupBy(bookLikes.bookId),
    db
      .select({ bookId: bookComments.bookId, total: count() })
      .from(bookComments)
      .where(
        and(
          inArray(bookComments.bookId, bookIds),
          gte(bookComments.createdAt, windowStart),
        ),
      )
      .groupBy(bookComments.bookId),
    db
      .select({ bookId: chapterReads.bookId, total: count() })
      .from(chapterReads)
      .where(
        and(
          inArray(chapterReads.bookId, bookIds),
          gte(chapterReads.readAt, windowStart),
        ),
      )
      .groupBy(chapterReads.bookId),
    db
      .select({
        bookId: books.id,
        total: count(),
      })
      .from(follows)
      .innerJoin(books, eq(books.userId, follows.followeeId))
      .where(
        and(
          inArray(books.id, bookIds),
          gte(follows.createdAt, windowStart),
        ),
      )
      .groupBy(books.id),
  ])

  const map = new Map<string, TrendingSignalCounts>()
  function bump(
    bookId: string,
    key: keyof TrendingSignalCounts,
    value: number,
  ): void {
    const existing = map.get(bookId) ?? {
      likes: 0,
      comments: 0,
      reads: 0,
      follows: 0,
    }
    existing[key] = value
    map.set(bookId, existing)
  }
  for (const r of likeRows) bump(r.bookId, 'likes', Number(r.total))
  for (const r of commentRows) bump(r.bookId, 'comments', Number(r.total))
  for (const r of readRows) bump(r.bookId, 'reads', Number(r.total))
  for (const r of followRows) bump(r.bookId, 'follows', Number(r.total))
  return map
}

/**
 * Issue #32: Ranks a candidate window of book rows by time-decayed trending
 * score using cumulative all-time counts (likes * 3 + comments * 2 + bookmarks)
 * divided by (hoursAgo + 2)^1.5. Loads cumulative counts in parallel via GROUP
 * BY queries against bookLikes, bookComments, bookmarks. Returns rows sorted by
 * score desc with id desc tiebreak.
 */
export async function rankByTrendingScore(
  candidates: RawBookRow[],
): Promise<RawBookRow[]> {
  if (candidates.length === 0) return []
  const counts = await loadCumulativeBookCounts(candidates.map((c) => c.id))
  const now = Date.now()
  const scored = candidates.map((c) => {
    const cc = counts.get(c.id) ?? { likes: 0, comments: 0, bookmarks: 0 }
    const ref = c.firstPubliclyDiscoverableAt ?? c.updatedAt
    const hoursAgo = Math.max(0, (now - ref.getTime()) / 3_600_000)
    return {
      row: c,
      // TODO(#32): For You orchestrator currently uses time-decay; swap to
      // computeBookTrendingScore over loadTrendingSignals for parity.
      score: computeTrendingScore({
        likeCount: cc.likes,
        commentCount: cc.comments,
        bookmarkCount: cc.bookmarks,
        hoursAgo,
      }),
    }
  })
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.row.id.localeCompare(a.row.id)
  })
  return scored.map((s) => s.row)
}

/** Issue #32: cumulative all-time engagement counts per book id. */
export type CumulativeBookCounts = {
  likes: number
  comments: number
  bookmarks: number
}

/**
 * Issue #32: Load cumulative all-time engagement counts for a set of book ids.
 * Runs 3 GROUP BY queries in parallel and stitches into a Map. Used by the
 * time-decayed trending ranker.
 */
export async function loadCumulativeBookCounts(
  bookIds: string[],
): Promise<Map<string, CumulativeBookCounts>> {
  if (bookIds.length === 0) return new Map()

  // Local imports to avoid circular issues — bookmarks isn't yet imported above.
  const { bookmarks } = await import('@/db/schema')

  const [likeRows, commentRows, bookmarkRows] = await Promise.all([
    db
      .select({ bookId: bookLikes.bookId, total: count() })
      .from(bookLikes)
      .where(inArray(bookLikes.bookId, bookIds))
      .groupBy(bookLikes.bookId),
    db
      .select({ bookId: bookComments.bookId, total: count() })
      .from(bookComments)
      .where(inArray(bookComments.bookId, bookIds))
      .groupBy(bookComments.bookId),
    db
      .select({ bookId: bookmarks.bookId, total: count() })
      .from(bookmarks)
      .where(inArray(bookmarks.bookId, bookIds))
      .groupBy(bookmarks.bookId),
  ])

  const map = new Map<string, CumulativeBookCounts>()
  function bump(
    bookId: string,
    key: keyof CumulativeBookCounts,
    value: number,
  ): void {
    const existing = map.get(bookId) ?? { likes: 0, comments: 0, bookmarks: 0 }
    existing[key] = value
    map.set(bookId, existing)
  }
  for (const r of likeRows) bump(r.bookId, 'likes', Number(r.total))
  for (const r of commentRows) bump(r.bookId, 'comments', Number(r.total))
  for (const r of bookmarkRows) bump(r.bookId, 'bookmarks', Number(r.total))
  return map
}

