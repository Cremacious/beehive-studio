'use server'

/**
 * Issue #21 — Bookmarks shelf actions (Variant A redesign).
 *
 * `getBookmarkedBooksAction` returns the viewer's bookmarked books, paginated,
 * with sidebar filters (search query, status bucket, genre multi-select) and
 * facet counts powering the sidebar. Per-book reading progress derives from
 * `chapter_reads` rows.
 *
 * Strategy: materialize the viewer's full bookmark set (bounded — most users
 * have <50; we cap at MAX_FETCH defensively), join authors + chapter counts +
 * read counts in batched queries, gate per-row via canReadBook, compute facets
 * from the full visible set, then apply user filters / sort / page in JS. This
 * keeps the facet counts honest (matching what's actually filterable) and
 * sidesteps the cross-table SQL filter+count gymnastics.
 */

import { db } from '@/db'
import {
  bookmarks,
  books,
  userProfiles,
  chapters,
  chapterReads,
  bookLikes,
} from '@/db/schema'
import { and, eq, desc, inArray, count, sql, isNotNull } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { canReadBook } from '@/lib/books/can-read'
import type { ActionResult } from './book.actions'

export type BookmarkSort = 'recent' | 'title' | 'author' | 'progress'
export type BookmarkStatus = 'all' | 'reading' | 'not-started' | 'finished'

export type BookmarkedBook = {
  id: string
  title: string
  coverUrl: string | null
  synopsis: string | null
  genre: string | null
  authorUserId: string
  authorUsername: string | null
  authorDisplayName: string | null
  bookmarkedAt: Date
  chapterCount: number
  chaptersRead: number
  /** Derived: finished if read>=total>0; reading if 0<read<total; not-started otherwise. */
  derivedStatus: Exclude<BookmarkStatus, 'all'>
}

export type BookmarkFacets = {
  status: { all: number; reading: number; notStarted: number; finished: number }
  genres: Array<{ slug: string; count: number }>
}

export type TrendingBookCard = {
  id: string
  title: string
  coverUrl: string | null
  authorUserId: string
  authorUsername: string | null
  genre: string | null
  likeCount: number
}

const PAGE_SIZE = 24
const MAX_FETCH = 500

export async function getBookmarkedBooksAction(input: {
  q?: string
  status?: BookmarkStatus
  genres?: string[]
  sort?: BookmarkSort
  page?: number
}): Promise<
  ActionResult<{
    rows: BookmarkedBook[]
    totalCount: number
    filteredCount: number
    facets: BookmarkFacets
  }>
> {
  const userId = await requireAuth()
  const q = (input.q ?? '').trim().toLowerCase()
  const statusFilter: BookmarkStatus = input.status ?? 'all'
  const genreFilter = new Set((input.genres ?? []).map((g) => g.toLowerCase()))
  const sort: BookmarkSort = input.sort ?? 'recent'
  const page = Math.max(1, input.page ?? 1)

  // 1. Full viewer bookmark set with book core + author + bookmarkedAt.
  const rawRows = await db
    .select({
      bookId: bookmarks.bookId,
      bookmarkedAt: bookmarks.createdAt,
      title: books.title,
      coverUrl: books.coverUrl,
      synopsis: books.synopsis,
      genre: books.genre,
      authorUserId: books.userId,
    })
    .from(bookmarks)
    .innerJoin(books, eq(books.id, bookmarks.bookId))
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt))
    .limit(MAX_FETCH)

  if (rawRows.length === 0) {
    return {
      success: true,
      data: {
        rows: [],
        totalCount: 0,
        filteredCount: 0,
        facets: {
          status: { all: 0, reading: 0, notStarted: 0, finished: 0 },
          genres: [],
        },
      },
    }
  }

  const bookIds = rawRows.map((r) => r.bookId)

  // 2. Batched parallel joins: authors, chapter counts, chapter reads.
  const authorIds = Array.from(new Set(rawRows.map((r) => r.authorUserId)))
  const [profileRows, chapterCountRows, readCountRows] = await Promise.all([
    db
      .select({
        userId: userProfiles.userId,
        username: userProfiles.username,
        displayName: userProfiles.displayName,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, authorIds)),
    db
      .select({ bookId: chapters.bookId, n: count() })
      .from(chapters)
      .where(inArray(chapters.bookId, bookIds))
      .groupBy(chapters.bookId),
    db
      .select({ bookId: chapterReads.bookId, n: count() })
      .from(chapterReads)
      .where(
        and(
          eq(chapterReads.userId, userId),
          inArray(chapterReads.bookId, bookIds),
        ),
      )
      .groupBy(chapterReads.bookId),
  ])
  const profileMap = new Map(profileRows.map((p) => [p.userId, p]))
  const chapterCountMap = new Map(
    chapterCountRows.map((r) => [r.bookId, Number(r.n)]),
  )
  const readCountMap = new Map(
    readCountRows.map((r) => [r.bookId, Number(r.n)]),
  )

  // 3. Per-row access gate (filter books the viewer can no longer open).
  const gatedNullable: Array<BookmarkedBook | null> = await Promise.all(
    rawRows.map(async (r): Promise<BookmarkedBook | null> => {
      const access = await canReadBook(r.bookId, userId)
      if (!access.ok) return null
      const profile = profileMap.get(r.authorUserId)
      const chapterCount = chapterCountMap.get(r.bookId) ?? 0
      const chaptersRead = readCountMap.get(r.bookId) ?? 0
      let derivedStatus: BookmarkedBook['derivedStatus']
      if (chapterCount > 0 && chaptersRead >= chapterCount) {
        derivedStatus = 'finished'
      } else if (chaptersRead > 0) {
        derivedStatus = 'reading'
      } else {
        derivedStatus = 'not-started'
      }
      return {
        id: r.bookId,
        title: r.title,
        coverUrl: r.coverUrl,
        synopsis: r.synopsis ?? null,
        genre: r.genre ?? null,
        authorUserId: r.authorUserId,
        authorUsername: profile?.username ?? null,
        authorDisplayName: profile?.displayName ?? null,
        bookmarkedAt: r.bookmarkedAt,
        chapterCount,
        chaptersRead,
        derivedStatus,
      }
    }),
  )
  const visible: BookmarkedBook[] = gatedNullable.filter(
    (r): r is BookmarkedBook => r !== null,
  )

  // 4. Facets from the FULL visible set (so sidebar counts stay honest).
  const facets: BookmarkFacets = {
    status: {
      all: visible.length,
      reading: visible.filter((b) => b.derivedStatus === 'reading').length,
      notStarted: visible.filter((b) => b.derivedStatus === 'not-started').length,
      finished: visible.filter((b) => b.derivedStatus === 'finished').length,
    },
    genres: (() => {
      const counts = new Map<string, number>()
      for (const b of visible) {
        if (!b.genre) continue
        const slug = b.genre.toLowerCase()
        counts.set(slug, (counts.get(slug) ?? 0) + 1)
      }
      return Array.from(counts.entries())
        .map(([slug, c]) => ({ slug, count: c }))
        .sort((a, b) => b.count - a.count)
    })(),
  }

  // 5. Apply user filters.
  let filtered = visible
  if (statusFilter !== 'all') {
    const want = statusFilter === 'not-started' ? 'not-started' : statusFilter
    filtered = filtered.filter((b) => b.derivedStatus === want)
  }
  if (genreFilter.size > 0) {
    filtered = filtered.filter((b) => b.genre && genreFilter.has(b.genre.toLowerCase()))
  }
  if (q) {
    filtered = filtered.filter((b) => {
      const hay = [
        b.title,
        b.authorUsername ?? '',
        b.authorDisplayName ?? '',
        b.genre ?? '',
      ].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }

  // 6. Sort.
  filtered.sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title)
    if (sort === 'author') {
      const aa = (a.authorUsername ?? a.authorDisplayName ?? '').toLowerCase()
      const bb = (b.authorUsername ?? b.authorDisplayName ?? '').toLowerCase()
      if (!aa && !bb) return 0
      if (!aa) return 1
      if (!bb) return -1
      return aa.localeCompare(bb)
    }
    if (sort === 'progress') {
      const ap = a.chapterCount > 0 ? a.chaptersRead / a.chapterCount : 0
      const bp = b.chapterCount > 0 ? b.chaptersRead / b.chapterCount : 0
      return bp - ap
    }
    // 'recent' default
    return b.bookmarkedAt.getTime() - a.bookmarkedAt.getTime()
  })

  // 7. Paginate.
  const filteredCount = filtered.length
  const offset = (page - 1) * PAGE_SIZE
  const rows = filtered.slice(offset, offset + PAGE_SIZE)

  return {
    success: true,
    data: { rows, totalCount: visible.length, filteredCount, facets },
  }
}

/**
 * Empty-state suggestion strip. Top discoverable books by likeCount. Excludes
 * any books the viewer already has bookmarked (so the suggestion doesn't loop
 * back to something they've already saved).
 */
export async function getBookmarksEmptySuggestionsAction(input: {
  limit?: number
}): Promise<ActionResult<TrendingBookCard[]>> {
  const userId = await requireAuth()
  const limit = Math.min(12, Math.max(1, input.limit ?? 4))

  // IDs of books the viewer has already bookmarked — exclude.
  const bookmarkedIds = await db
    .select({ bookId: bookmarks.bookId })
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
  const bookmarkedSet = new Set(bookmarkedIds.map((r) => r.bookId))

  // Like-count denorm + filter to publicly readable. Books carry no likeCount
  // column, so we aggregate. Wider fetch (3x) so excluding already-bookmarked
  // still leaves a full result set.
  const fetchN = limit * 3 + 4
  const candidates = await db
    .select({
      id: books.id,
      title: books.title,
      coverUrl: books.coverUrl,
      authorUserId: books.userId,
      genre: books.genre,
      likeCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${bookLikes} WHERE ${bookLikes.bookId} = ${books.id}), 0)`,
    })
    .from(books)
    .where(
      and(
        eq(books.visibility, 'PUBLIC'),
        eq(books.discoverable, true),
        isNotNull(books.title),
      ),
    )
    .orderBy(sql`like_count DESC NULLS LAST`)
    .limit(fetchN)

  const filtered = candidates.filter((c) => !bookmarkedSet.has(c.id)).slice(0, limit)
  if (filtered.length === 0) return { success: true, data: [] }

  const authorIds = Array.from(new Set(filtered.map((c) => c.authorUserId)))
  const profileRows = await db
    .select({ userId: userProfiles.userId, username: userProfiles.username })
    .from(userProfiles)
    .where(inArray(userProfiles.userId, authorIds))
  const profileMap = new Map(profileRows.map((p) => [p.userId, p]))

  return {
    success: true,
    data: filtered.map((c) => ({
      id: c.id,
      title: c.title,
      coverUrl: c.coverUrl ?? null,
      authorUserId: c.authorUserId,
      authorUsername: profileMap.get(c.authorUserId)?.username ?? null,
      genre: c.genre ?? null,
      likeCount: Number(c.likeCount ?? 0),
    })),
  }
}
