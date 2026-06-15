'use server'

import { cache } from 'react'
import { db } from '@/db'
import { books, bookLikes } from '@/db/schema'
import { follows, chapterReads } from '@/db/schema/social'
import { and, count, desc, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { getOptionalUserId } from '@/lib/require-auth'
import {
  PAGE_SIZE_BOOKS,
  applyBookFilterInputs,
  buildPublicBookFilters,
  getBlockedAuthorIdsForViewer,
  projectToBookCards,
  rankByTrendingScore,
  type BookCard,
  type FilterInputs,
  type RawBookRow,
} from './discover-shared'
import { topGenres, type SignalRow } from '@/lib/discover/taste-vector'
import { getPlatformTopGenres } from '@/lib/discover/platform-top-genres'
import { stitchTiers } from '@/lib/discover/stitch-tiers'
import type { ActionResult } from './book.actions'

const TIER_QUOTAS = { tier1: 6, tier2: 4, tier3: 2 } as const
const TIER_FETCH_LIMIT = 60

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

/**
 * Returns books ordered by all-time like count (descending), with numbered
 * pagination. Accepts the same `FilterInputs` shape as the Search action so
 * the Popular rail can honor user-selected filters (genre / length / status /
 * series / updated / q).
 */
export async function getPopularBooksAction(args: {
  page?: number
  filters?: FilterInputs
}): Promise<
  ActionResult<{ books: BookCard[]; totalCount: number }>
> {
  const viewerId = await getOptionalUserId()
  const blocked = await getBlockedAuthorIdsForViewer(viewerId)
  const page = Math.max(1, Math.floor(args.page ?? 1))
  const offset = (page - 1) * PAGE_SIZE_BOOKS

  const filters = buildPublicBookFilters(undefined, blocked)
  if (args.filters) applyBookFilterInputs(filters, args.filters)

  const likeCountExpr = sql<number>`(SELECT COUNT(*) FROM ${bookLikes} WHERE ${bookLikes.bookId} = ${books.id})`

  const [totalCountRows, pageRows] = await Promise.all([
    db.select({ total: count(books.id) }).from(books).where(and(...filters)),
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
      .where(and(...filters))
      .orderBy(desc(likeCountExpr), desc(books.id))
      .limit(PAGE_SIZE_BOOKS)
      .offset(offset),
  ])
  const totalCount = Number(totalCountRows[0]?.total ?? 0)
  const cards = await projectToBookCards(pageRows)
  return { success: true, data: { books: cards, totalCount } }
}

/**
 * Tier 1 candidate pool for the For You rail: books authored by people the
 * viewer follows, excluding books the viewer has already liked or read a
 * chapter of. Ordered by recency. Private helper consumed by the orchestrator
 * (W2.6); not exported.
 */
async function tier1Candidates(opts: {
  viewerId: string
  filterInputs: FilterInputs
  blocked: Set<string>
  limit: number
}): Promise<RawBookRow[]> {
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

  const conds = [
    ...buildPublicBookFilters(undefined, opts.blocked),
    inArray(books.userId, followedAuthorIdsSubquery),
    notInArray(books.id, likedBookIdsSubquery),
    notInArray(books.id, readBookIdsSubquery),
  ]
  applyBookFilterInputs(conds, opts.filterInputs)

  return db
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
    .where(and(...conds))
    .orderBy(desc(books.updatedAt), desc(books.id))
    .limit(opts.limit)
}

/**
 * Tier 2 candidate pool for the For You rail: books in the viewer's top 3
 * inferred-genre buckets (derived from likes×3 + followed-author own-books×2 +
 * viewer's own-books×1 weighted signal), excluding tier 1 ids, ranked by
 * trending score. Private helper consumed by the orchestrator (W2.6).
 */
async function tier2Candidates(opts: {
  viewerId: string
  excludeIds: Set<string>
  filterInputs: FilterInputs
  blocked: Set<string>
  limit: number
}): Promise<RawBookRow[]> {
  // Step 1: fetch viewer's signal rows (3 parallel queries).
  const [likedGenres, followedAuthorGenres, ownBookGenres] = await Promise.all([
    db
      .select({ genre: books.genre })
      .from(bookLikes)
      .innerJoin(books, eq(books.id, bookLikes.bookId))
      .where(eq(bookLikes.userId, opts.viewerId)),
    db
      .select({ genre: books.genre })
      .from(follows)
      .innerJoin(books, eq(books.userId, follows.followeeId))
      .where(eq(follows.followerId, opts.viewerId)),
    db
      .select({ genre: books.genre })
      .from(books)
      .where(eq(books.userId, opts.viewerId)),
  ])

  // Step 2: weighted signal rows → top 3 genres.
  const rows: SignalRow[] = [
    ...likedGenres.map((r) => ({ genre: r.genre, weight: 3 })),
    ...followedAuthorGenres.map((r) => ({ genre: r.genre, weight: 2 })),
    ...ownBookGenres.map((r) => ({ genre: r.genre, weight: 1 })),
  ]
  const top3 = topGenres(rows, 3)
  if (top3.length === 0) return []

  // Step 3: fetch books in those genres, excluding tier 1, ranked by trending.
  const conds = [
    ...buildPublicBookFilters(undefined, opts.blocked),
    inArray(books.genre, top3),
  ]
  if (opts.excludeIds.size > 0) {
    conds.push(notInArray(books.id, Array.from(opts.excludeIds)))
  }
  applyBookFilterInputs(conds, opts.filterInputs)

  // Fetch a 200-row candidate window, then rank in JS.
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
    .where(and(...conds))
    .limit(200)

  const ranked = await rankByTrendingScore(candidates)
  return ranked.slice(0, opts.limit)
}

/**
 * Tier 3 candidate pool for the For You rail: fallback for viewers with no
 * personal signal. Uses the cached platform-wide most-followed 3 genres,
 * excludes ids already returned by tier 1/2, ranked by trending score.
 * Private helper consumed by the orchestrator (W2.6).
 */
async function tier3Candidates(opts: {
  excludeIds: Set<string>
  filterInputs: FilterInputs
  blocked: Set<string>
  limit: number
}): Promise<RawBookRow[]> {
  const top3 = await getPlatformTopGenres()
  if (top3.length === 0) return []

  const conds = [
    ...buildPublicBookFilters(undefined, opts.blocked),
    inArray(books.genre, top3),
  ]
  if (opts.excludeIds.size > 0) {
    conds.push(notInArray(books.id, Array.from(opts.excludeIds)))
  }
  applyBookFilterInputs(conds, opts.filterInputs)

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
    .where(and(...conds))
    .limit(200)

  const ranked = await rankByTrendingScore(candidates)
  return ranked.slice(0, opts.limit)
}

/**
 * For You is a 3-tier hybrid recommendation algorithm:
 *   Tier 1: books from followed authors the viewer hasn't liked or read
 *   Tier 2: books in the viewer's top 3 genres (taste vector: likes×3 +
 *           follows×2 + own×1), ranked by 7-day trending score
 *   Tier 3: trending books in the platform's most-followed 3 genres
 *           (fallback for cold-start users with no signal)
 *
 * Stitched 6/4/2 per 12-card page with tier overflow: if a higher tier is
 * short on the page, lower tiers backfill to keep pages full.
 *
 * totalCount is the sum of distinct tier candidate counts (capped at 180).
 */
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
  const blocked = await getBlockedAuthorIdsForViewer(args.viewerId)

  // Tier 1.
  const t1 = await tier1Candidates({
    viewerId: args.viewerId,
    filterInputs,
    blocked,
    limit: TIER_FETCH_LIMIT,
  })
  const t1Ids = new Set(t1.map((r) => r.id))

  // Tier 2 (exclude tier 1).
  const t2 = await tier2Candidates({
    viewerId: args.viewerId,
    excludeIds: t1Ids,
    filterInputs,
    blocked,
    limit: TIER_FETCH_LIMIT,
  })
  const t12Ids = new Set([...t1Ids, ...t2.map((r) => r.id)])

  // Tier 3 (exclude tier 1 ∪ tier 2).
  const t3 = await tier3Candidates({
    excludeIds: t12Ids,
    filterInputs,
    blocked,
    limit: TIER_FETCH_LIMIT,
  })

  const totalCount = t1.length + t2.length + t3.length
  const stitched = stitchTiers({
    t1,
    t2,
    t3,
    page,
    pageSize: PAGE_SIZE_BOOKS,
    quotas: TIER_QUOTAS,
  })

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
