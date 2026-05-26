'use server'

// Schema notes (divergences from the plan code, captured here for future readers):
// - follows table uses followerId / followeeId (NOT followingId).
// - userProfiles uses avatarUrl (NOT image). We alias to `image` in FeedAuthor.
// - books has no publishedAt column; "published" = status='PUBLISHED'. We use
//   books.updatedAt as the publish timestamp for new_book items (the row is
//   touched when publishBookAction sets status, see lib/actions/book.actions.ts).
// - chapters table has no publishedAt either. Per spec §10 we fall back to
//   binderItems.updatedAt for chapter feed items, scoped to chapters whose
//   parent book is PUBLISHED.
// - sparks uses `title` for the prompt text (NOT `prompt`).
// - userProfiles.username is nullable; we filter rows missing a username out so
//   FeedAuthor.username is always a string.

import { db } from '@/db'
import { books, binderItems, sparks, follows, users, userProfiles } from '@/db/schema'
import { and, eq, inArray, sql, gte, desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import type { ActionResult } from './book.actions'
import type { FeedItem } from '@/lib/types/community'

const FEED_WINDOW_DAYS = 30
const PAGE_SIZE = 20

type FeedCursor = { timestamp: Date; id: string }

function encodeCursor(c: FeedCursor): string {
  return `${c.timestamp.toISOString()}_${c.id}`
}

function decodeCursor(raw: string): FeedCursor | null {
  const idx = raw.indexOf('_')
  if (idx === -1) return null
  const ts = new Date(raw.slice(0, idx))
  const id = raw.slice(idx + 1)
  if (isNaN(ts.getTime()) || !id) return null
  return { timestamp: ts, id }
}

type SourceRow = { item: FeedItem; ts: Date; id: string }

async function fetchNewChapters(
  followedIds: string[],
  windowStart: Date,
  limit: number,
): Promise<SourceRow[]> {
  const rows = await db
    .select({
      chapterId: binderItems.id,
      bookId: books.id,
      bookTitle: books.title,
      chapterTitle: binderItems.title,
      chapterOrder: binderItems.order,
      updatedAt: binderItems.updatedAt,
      authorId: users.id,
      authorUsername: userProfiles.username,
      authorImage: userProfiles.avatarUrl,
    })
    .from(binderItems)
    .innerJoin(books, eq(binderItems.bookId, books.id))
    .innerJoin(users, eq(books.userId, users.id))
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(and(
      eq(binderItems.type, 'chapter'),
      inArray(books.userId, followedIds),
      eq(books.status, 'PUBLISHED'),
      gte(binderItems.updatedAt, windowStart),
      sql`${userProfiles.username} IS NOT NULL`,
    ))
    .orderBy(desc(binderItems.updatedAt))
    .limit(limit)

  return rows.map(r => ({
    item: {
      type: 'new_chapter' as const,
      chapterId: r.chapterId,
      bookId: r.bookId,
      bookTitle: r.bookTitle,
      chapterTitle: r.chapterTitle ?? 'Untitled',
      chapterNumber: r.chapterOrder ?? 0,
      author: {
        id: r.authorId,
        username: r.authorUsername as string,
        image: r.authorImage,
      },
      publishedAt: r.updatedAt,
    },
    ts: r.updatedAt,
    id: r.chapterId,
  }))
}

async function fetchNewBooks(
  followedIds: string[],
  windowStart: Date,
  limit: number,
): Promise<SourceRow[]> {
  const rows = await db
    .select({
      bookId: books.id,
      bookTitle: books.title,
      bookCover: books.coverUrl,
      synopsis: books.synopsis,
      // No publishedAt column — use updatedAt as the publish timestamp.
      publishedAt: books.updatedAt,
      authorId: users.id,
      authorUsername: userProfiles.username,
      authorImage: userProfiles.avatarUrl,
    })
    .from(books)
    .innerJoin(users, eq(books.userId, users.id))
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(and(
      inArray(books.userId, followedIds),
      eq(books.status, 'PUBLISHED'),
      gte(books.updatedAt, windowStart),
      sql`${userProfiles.username} IS NOT NULL`,
    ))
    .orderBy(desc(books.updatedAt))
    .limit(limit)

  return rows.map(r => ({
    item: {
      type: 'new_book' as const,
      bookId: r.bookId,
      bookTitle: r.bookTitle,
      bookCover: r.bookCover,
      synopsis: r.synopsis,
      author: {
        id: r.authorId,
        username: r.authorUsername as string,
        image: r.authorImage,
      },
      publishedAt: r.publishedAt,
    },
    ts: r.publishedAt,
    id: r.bookId,
  }))
}

async function fetchNewSparks(
  followedIds: string[],
  windowStart: Date,
  limit: number,
): Promise<SourceRow[]> {
  const rows = await db
    .select({
      sparkId: sparks.id,
      // sparks table uses `title` for the prompt text.
      prompt: sparks.title,
      deadline: sparks.deadline,
      createdAt: sparks.createdAt,
      authorId: users.id,
      authorUsername: userProfiles.username,
      authorImage: userProfiles.avatarUrl,
    })
    .from(sparks)
    .innerJoin(users, eq(sparks.creatorId, users.id))
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(and(
      inArray(sparks.creatorId, followedIds),
      gte(sparks.createdAt, windowStart),
      sql`${userProfiles.username} IS NOT NULL`,
    ))
    .orderBy(desc(sparks.createdAt))
    .limit(limit)

  return rows.map(r => ({
    item: {
      type: 'new_spark' as const,
      sparkId: r.sparkId,
      sparkPrompt: r.prompt,
      deadline: r.deadline,
      author: {
        id: r.authorId,
        username: r.authorUsername as string,
        image: r.authorImage,
      },
      createdAt: r.createdAt,
    },
    ts: r.createdAt,
    id: r.sparkId,
  }))
}

export async function getCommunityFeedAction(args: {
  limit?: number
  cursor?: string | null
} = {}): Promise<ActionResult<{ items: FeedItem[]; nextCursor: string | null; hasAnyFollows: boolean }>> {
  const userId = await requireAuth()
  const limit = Math.min(args.limit ?? PAGE_SIZE, 50)
  const cursor = args.cursor ? decodeCursor(args.cursor) : null

  // Step 1: who do I follow?
  const followed = await db
    .select({ id: follows.followeeId })
    .from(follows)
    .where(eq(follows.followerId, userId))
  const followedIds = followed.map(r => r.id)
  if (followedIds.length === 0) {
    return { success: true, data: { items: [], nextCursor: null, hasAnyFollows: false } }
  }

  const windowStart = new Date(Date.now() - FEED_WINDOW_DAYS * 86_400_000)

  // Step 2: query each source in parallel.
  const [chapterRows, bookRows, sparkRows] = await Promise.all([
    fetchNewChapters(followedIds, windowStart, limit * 2),
    fetchNewBooks(followedIds, windowStart, limit * 2),
    fetchNewSparks(followedIds, windowStart, limit * 2),
  ])

  // Step 3: merge + sort + paginate (timestamp DESC, then id DESC for stable tiebreak).
  const merged = [...chapterRows, ...bookRows, ...sparkRows].sort((a, b) => {
    const tsDiff = b.ts.getTime() - a.ts.getTime()
    if (tsDiff !== 0) return tsDiff
    return b.id.localeCompare(a.id)
  })

  let filtered = merged
  if (cursor) {
    filtered = merged.filter(row => {
      const tsDiff = row.ts.getTime() - cursor.timestamp.getTime()
      if (tsDiff < 0) return true
      if (tsDiff > 0) return false
      return row.id < cursor.id
    })
  }

  const page = filtered.slice(0, limit)
  const next = filtered.length > limit ? filtered[limit] : null
  const nextCursor = next ? encodeCursor({ timestamp: next.ts, id: next.id }) : null

  return {
    success: true,
    data: {
      items: page.map(p => p.item),
      nextCursor,
      hasAnyFollows: true,
    },
  }
}
