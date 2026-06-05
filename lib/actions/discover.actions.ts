'use server'

import { db } from '@/db'
import { books, binderItems, chapters, bookLikes, bookmarks, bookComments } from '@/db/schema'
import { userProfiles } from '@/db/schema'
import { eq, and, desc, sql, count, isNull, ilike, or } from 'drizzle-orm'
import { getOptionalUserId } from '@/lib/require-auth'
import { canReadBook } from '@/lib/books/can-read'
import { isBlocked } from '@/lib/social/is-blocked'
import { searchBooksSchema } from '@/lib/validations/reading-list'

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

export type DiscoverWriter = {
  userId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  bookCount: number
}

import type { ActionResult } from './book.actions'

const PAGE_SIZE = 20

export async function getDiscoverFeedAction(
  sort: 'trending' | 'popular' | 'new' = 'trending',
  genre?: string,
  page: number = 1
): Promise<ActionResult<{ books: DiscoverBook[]; hasMore: boolean }>> {
  const offset = (page - 1) * PAGE_SIZE
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const likeCountSq = db
    .select({ bookId: bookLikes.bookId, likeTotal: count().as('like_total') })
    .from(bookLikes)
    .groupBy(bookLikes.bookId)
    .as('like_counts')

  const bookmarkCountSq = db
    .select({ bookId: bookmarks.bookId, bookmarkTotal: count().as('bookmark_total') })
    .from(bookmarks)
    .groupBy(bookmarks.bookId)
    .as('bookmark_counts')

  const recentLikesSq = db
    .select({ bookId: bookLikes.bookId, recentLikeTotal: count().as('recent_like_total') })
    .from(bookLikes)
    .where(sql`${bookLikes.createdAt} > ${sevenDaysAgo}`)
    .groupBy(bookLikes.bookId)
    .as('recent_likes')

  const recentBookmarksSq = db
    .select({ bookId: bookmarks.bookId, recentBookmarkTotal: count().as('recent_bookmark_total') })
    .from(bookmarks)
    .where(sql`${bookmarks.createdAt} > ${sevenDaysAgo}`)
    .groupBy(bookmarks.bookId)
    .as('recent_bookmarks')

  const wordCountSq = db
    .select({ bookId: chapters.bookId, wordTotal: sql<number>`SUM(${chapters.wordCount})`.as('word_total') })
    .from(chapters)
    .groupBy(chapters.bookId)
    .as('word_counts')

  const baseQuery = db
    .select({
      id: books.id,
      title: books.title,
      genre: books.genre,
      coverUrl: books.coverUrl,
      synopsis: books.synopsis,
      tags: books.tags,
      updatedAt: books.updatedAt,
      likeCount: sql<number>`COALESCE(${likeCountSq.likeTotal}, 0)`,
      bookmarkCount: sql<number>`COALESCE(${bookmarkCountSq.bookmarkTotal}, 0)`,
      wordCount: sql<number>`COALESCE(${wordCountSq.wordTotal}, 0)`,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
      seriesName: books.seriesName,
      seriesNumber: books.seriesNumber,
    })
    .from(books)
    .innerJoin(userProfiles, eq(books.userId, userProfiles.userId))
    .leftJoin(likeCountSq, eq(books.id, likeCountSq.bookId))
    .leftJoin(bookmarkCountSq, eq(books.id, bookmarkCountSq.bookId))
    .leftJoin(recentLikesSq, eq(books.id, recentLikesSq.bookId))
    .leftJoin(recentBookmarksSq, eq(books.id, recentBookmarksSq.bookId))
    .leftJoin(wordCountSq, eq(books.id, wordCountSq.bookId))
    .where(
      and(
        eq(books.discoverable, true),
        eq(books.visibility, 'PUBLIC'),
        genre ? eq(books.genre, genre) : undefined
      )
    )

  const ordered =
    sort === 'trending'
      ? baseQuery.orderBy(
          desc(sql`COALESCE(${recentLikesSq.recentLikeTotal}, 0) + COALESCE(${recentBookmarksSq.recentBookmarkTotal}, 0)`)
        )
      : sort === 'popular'
      ? baseQuery.orderBy(
          desc(sql`COALESCE(${likeCountSq.likeTotal}, 0) + COALESCE(${bookmarkCountSq.bookmarkTotal}, 0)`)
        )
      : baseQuery.orderBy(desc(books.updatedAt))

  const rows = await ordered.limit(PAGE_SIZE + 1).offset(offset)
  const hasMore = rows.length > PAGE_SIZE

  return {
    success: true,
    data: {
      books: rows.slice(0, PAGE_SIZE),
      hasMore,
    },
  }
}

/**
 * Returns the book data for the reader page. Does NOT gate by privacy.
 * Callers must gate access with `canReadBook()` before rendering.
 */
export async function getPublicBookAction(
  bookId: string
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

  const [likeCount, bookmarkCount, wordCountResult, chapterCountResult] = await Promise.all([
    db.select({ total: count() }).from(bookLikes).where(eq(bookLikes.bookId, bookId)),
    db.select({ total: count() }).from(bookmarks).where(eq(bookmarks.bookId, bookId)),
    db
      .select({ total: sql<number>`COALESCE(SUM(${chapters.wordCount}), 0)` })
      .from(chapters)
      .where(eq(chapters.bookId, bookId)),
    db
      .select({ total: count() })
      .from(binderItems)
      .where(and(eq(binderItems.bookId, bookId), eq(binderItems.type, 'chapter'))),
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
  page: number = 1
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

export async function getDiscoverWritersAction(): Promise<ActionResult<DiscoverWriter[]>> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const rows = await db
    .select({
      userId: userProfiles.userId,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
      bookCount: sql<number>`COUNT(DISTINCT ${books.id})`,
    })
    .from(books)
    .innerJoin(userProfiles, eq(books.userId, userProfiles.userId))
    .innerJoin(bookLikes, and(
      eq(bookLikes.bookId, books.id),
      sql`${bookLikes.createdAt} > ${sevenDaysAgo}`
    ))
    .where(and(eq(books.discoverable, true), eq(books.visibility, 'PUBLIC')))
    .groupBy(userProfiles.userId, userProfiles.username, userProfiles.displayName, userProfiles.avatarUrl)
    .orderBy(desc(sql`COUNT(${bookLikes.userId})`))
    .limit(3)

  return { success: true, data: rows }
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
 * Beehive search tab.
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
