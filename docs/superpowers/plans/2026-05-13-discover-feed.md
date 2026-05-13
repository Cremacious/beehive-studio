# Discover Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public discovery feed at `/discover` where anyone can browse published books, read them in-browser, and interact socially (like, bookmark, follow, comment).

**Architecture:** Three server-rendered pages in `(public)` route group (no auth required to browse). Social interactions are client components calling server actions — unauthenticated callers get `AUTH_REQUIRED` and see a sign-in prompt. Chapter content is rendered from TipTap JSON using the existing `tiptapToHtml` utility. Reading progress is tracked by upserting a single row per user+book in `readingProgress` (last chapter opened).

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, `drizzle-orm/sql` for complex aggregate queries, Tailwind v4, `lib/export/tiptap-to-html.ts` (reused).

---

## Schema Notes

Read these before writing any query:

- `books`: `id, userId, title, genre, visibility, status, coverUrl, synopsis, tags, updatedAt`. No `publishedAt` — "New" sort uses `updatedAt` (set by `publishBookAction`).
- `bookLikes`: PK `(userId, bookId)`, `createdAt`
- `bookmarks`: PK `(userId, bookId)`, `createdAt`
- `follows`: PK `(followerId, followeeId)`
- `bookComments`: `id, bookId, userId, content, parentId, createdAt`
- `readingProgress`: PK `(userId, bookId)`, `chapterId` (last chapter opened), `lastOpenedAt`
- `binderItems`: `id, bookId, type, title, order`. Filter `type = 'chapter'` for chapter lists.
- `chapters`: `id, bookId, binderItemId, content (jsonb), wordCount`
- `userProfiles`: `userId, username, displayName, avatarUrl, bio`

Discoverability: `status = 'PUBLISHED' AND visibility = 'PUBLIC'`. (The `explorable` column exists but is never set — do not use it as a filter.)

---

## Task 1: Discover Server Actions

**Files:**
- Create: `lib/actions/discover.actions.ts`

- [ ] **Step 1: Write the action file**

```ts
'use server'

import { db } from '@/db'
import { books, binderItems, chapters, bookLikes, bookmarks } from '@/db/schema'
import { userProfiles } from '@/db/schema'
import { eq, and, desc, sql, count, asc } from 'drizzle-orm'

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
  authorUsername: string
  authorDisplayName: string | null
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
  authorUsername: string
  authorDisplayName: string | null
  authorAvatarUrl: string | null
  likeCount: number
  bookmarkCount: number
  chapterCount: number
  wordCount: number
}

export type BookComment = {
  id: string
  content: string
  createdAt: Date
  authorUsername: string
  authorDisplayName: string | null
  authorAvatarUrl: string | null
}

export type DiscoverWriter = {
  userId: string
  username: string
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
    .select({ bookId: bookLikes.bookId, total: count().as('total') })
    .from(bookLikes)
    .groupBy(bookLikes.bookId)
    .as('like_counts')

  const bookmarkCountSq = db
    .select({ bookId: bookmarks.bookId, total: count().as('total') })
    .from(bookmarks)
    .groupBy(bookmarks.bookId)
    .as('bookmark_counts')

  const recentLikesSq = db
    .select({ bookId: bookLikes.bookId, total: count().as('total') })
    .from(bookLikes)
    .where(sql`${bookLikes.createdAt} > ${sevenDaysAgo}`)
    .groupBy(bookLikes.bookId)
    .as('recent_likes')

  const recentBookmarksSq = db
    .select({ bookId: bookmarks.bookId, total: count().as('total') })
    .from(bookmarks)
    .where(sql`${bookmarks.createdAt} > ${sevenDaysAgo}`)
    .groupBy(bookmarks.bookId)
    .as('recent_bookmarks')

  const wordCountSq = db
    .select({ bookId: chapters.bookId, total: sql<number>`SUM(${chapters.wordCount})`.as('total') })
    .from(chapters)
    .groupBy(chapters.bookId)
    .as('word_counts')

  let query = db
    .select({
      id: books.id,
      title: books.title,
      genre: books.genre,
      coverUrl: books.coverUrl,
      synopsis: books.synopsis,
      tags: books.tags,
      updatedAt: books.updatedAt,
      likeCount: sql<number>`COALESCE(${likeCountSq.total}, 0)`,
      bookmarkCount: sql<number>`COALESCE(${bookmarkCountSq.total}, 0)`,
      wordCount: sql<number>`COALESCE(${wordCountSq.total}, 0)`,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
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
        eq(books.status, 'PUBLISHED'),
        eq(books.visibility, 'PUBLIC'),
        genre ? eq(books.genre, genre) : undefined
      )
    )

  const ordered =
    sort === 'trending'
      ? query.orderBy(
          desc(sql`COALESCE(${recentLikesSq.total}, 0) + COALESCE(${recentBookmarksSq.total}, 0)`)
        )
      : sort === 'popular'
      ? query.orderBy(
          desc(sql`COALESCE(${likeCountSq.total}, 0) + COALESCE(${bookmarkCountSq.total}, 0)`)
        )
      : query.orderBy(desc(books.updatedAt))

  const rows = await ordered.limit(PAGE_SIZE + 1).offset(offset)
  const hasMore = rows.length > PAGE_SIZE

  return {
    success: true,
    data: {
      books: rows.slice(0, PAGE_SIZE) as DiscoverBook[],
      hasMore,
    },
  }
}

export async function getPublicBookAction(
  bookId: string
): Promise<ActionResult<PublicBook>> {
  const likeCount = await db
    .select({ total: count() })
    .from(bookLikes)
    .where(eq(bookLikes.bookId, bookId))
  const bookmarkCount = await db
    .select({ total: count() })
    .from(bookmarks)
    .where(eq(bookmarks.bookId, bookId))
  const wordCountResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${chapters.wordCount}), 0)` })
    .from(chapters)
    .where(eq(chapters.bookId, bookId))
  const chapterCountResult = await db
    .select({ total: count() })
    .from(binderItems)
    .where(and(eq(binderItems.bookId, bookId), eq(binderItems.type, 'chapter')))

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
    })
    .from(books)
    .innerJoin(userProfiles, eq(books.userId, userProfiles.userId))
    .where(
      and(eq(books.id, bookId), eq(books.status, 'PUBLISHED'), eq(books.visibility, 'PUBLIC'))
    )
    .limit(1)

  if (!row) return { success: false, error: 'NOT_FOUND' }

  return {
    success: true,
    data: {
      ...row,
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
    .where(and(eq(bookComments.bookId, bookId), sql`${bookComments.parentId} IS NULL`))
    .orderBy(desc(bookComments.createdAt))
    .limit(COMMENTS_PAGE_SIZE + 1)
    .offset(offset)

  const hasMore = rows.length > COMMENTS_PAGE_SIZE

  return {
    success: true,
    data: { comments: rows.slice(0, COMMENTS_PAGE_SIZE) as BookComment[], hasMore },
  }
}

export async function getDiscoverWritersAction(): Promise<ActionResult<DiscoverWriter[]>> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Authors of books with most recent likes — one entry per author, max 3
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
    .where(and(eq(books.status, 'PUBLISHED'), eq(books.visibility, 'PUBLIC')))
    .groupBy(userProfiles.userId, userProfiles.username, userProfiles.displayName, userProfiles.avatarUrl)
    .orderBy(desc(sql`COUNT(${bookLikes.userId})`))
    .limit(3)

  return { success: true, data: rows as DiscoverWriter[] }
}
```

Also add the missing import at top of the file — `bookComments` is from `@/db/schema`:
```ts
import { books, binderItems, chapters, bookLikes, bookmarks, bookComments } from '@/db/schema'
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Fix any errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/discover.actions.ts
git commit -m "feat: discover server actions (feed, book detail, comments, writers)"
```

---

## Task 2: Social Server Actions

**Files:**
- Create: `lib/actions/social.actions.ts`

- [ ] **Step 1: Write the action file**

```ts
'use server'

import { db } from '@/db'
import { bookLikes, bookmarks, follows, bookComments } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { z } from 'zod'
import type { ActionResult } from './book.actions'
import type { BookComment } from './discover.actions'
import { userProfiles } from '@/db/schema'

export async function toggleBookLikeAction(bookId: string): Promise<ActionResult<{ liked: boolean }>> {
  const userId = await requireAuth()

  const existing = await db
    .select()
    .from(bookLikes)
    .where(and(eq(bookLikes.userId, userId), eq(bookLikes.bookId, bookId)))
    .limit(1)

  if (existing.length > 0) {
    await db
      .delete(bookLikes)
      .where(and(eq(bookLikes.userId, userId), eq(bookLikes.bookId, bookId)))
    return { success: true, data: { liked: false } }
  }

  await db.insert(bookLikes).values({ userId, bookId })
  return { success: true, data: { liked: true } }
}

export async function toggleBookmarkAction(bookId: string): Promise<ActionResult<{ bookmarked: boolean }>> {
  const userId = await requireAuth()

  const existing = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.bookId, bookId)))
    .limit(1)

  if (existing.length > 0) {
    await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.bookId, bookId)))
    return { success: true, data: { bookmarked: false } }
  }

  await db.insert(bookmarks).values({ userId, bookId })
  return { success: true, data: { bookmarked: true } }
}

export async function toggleFollowAction(targetUserId: string): Promise<ActionResult<{ following: boolean }>> {
  const userId = await requireAuth()

  if (userId === targetUserId) return { success: false, error: 'CANNOT_FOLLOW_SELF' }

  const existing = await db
    .select()
    .from(follows)
    .where(and(eq(follows.followerId, userId), eq(follows.followeeId, targetUserId)))
    .limit(1)

  if (existing.length > 0) {
    await db
      .delete(follows)
      .where(and(eq(follows.followerId, userId), eq(follows.followeeId, targetUserId)))
    return { success: true, data: { following: false } }
  }

  await db.insert(follows).values({ followerId: userId, followeeId: targetUserId })
  return { success: true, data: { following: true } }
}

const addCommentSchema = z.object({
  content: z.string().min(1).max(1000),
})

export async function addCommentAction(
  bookId: string,
  content: string
): Promise<ActionResult<BookComment>> {
  const userId = await requireAuth()

  const parsed = addCommentSchema.safeParse({ content })
  if (!parsed.success) return { success: false, error: 'INVALID_CONTENT' }

  const [comment] = await db
    .insert(bookComments)
    .values({ bookId, userId, content: parsed.data.content })
    .returning()

  const [profile] = await db
    .select({
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1)

  return {
    success: true,
    data: {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      authorUsername: profile.username ?? '',
      authorDisplayName: profile.displayName,
      authorAvatarUrl: profile.avatarUrl,
    },
  }
}

export async function getUserSocialStateAction(
  bookId: string,
  authorUserId: string
): Promise<ActionResult<{ liked: boolean; bookmarked: boolean; following: boolean }>> {
  const userId = await requireAuth()

  const [liked, bookmarked, following] = await Promise.all([
    db.select().from(bookLikes).where(and(eq(bookLikes.userId, userId), eq(bookLikes.bookId, bookId))).limit(1),
    db.select().from(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.bookId, bookId))).limit(1),
    db.select().from(follows).where(and(eq(follows.followerId, userId), eq(follows.followeeId, authorUserId))).limit(1),
  ])

  return {
    success: true,
    data: {
      liked: liked.length > 0,
      bookmarked: bookmarked.length > 0,
      following: following.length > 0,
    },
  }
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Fix any errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/social.actions.ts
git commit -m "feat: social server actions (like, bookmark, follow, comment)"
```

---

## Task 3: Reading Progress Actions

**Files:**
- Create: `lib/actions/reading.actions.ts`

The `readingProgress` table stores one row per `(userId, bookId)` — it tracks the last chapter opened, not all chapters. Per-chapter read status on the book detail page is inferred: chapters appearing before `chapterId` in the ordered list are "read"; `chapterId` itself is "reading".

- [ ] **Step 1: Write the action file**

```ts
'use server'

import { db } from '@/db'
import { readingProgress, binderItems, chapters } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import type { ActionResult } from './book.actions'

export type ReadingProgressResult = {
  lastChapterId: string | null
  // IDs of binderItems (chapters) considered read — all before lastChapterId in order
  readChapterBinderItemIds: string[]
}

export async function markChapterReadAction(
  bookId: string,
  chapterId: string
): Promise<ActionResult<void>> {
  const userId = await requireAuth()

  await db
    .insert(readingProgress)
    .values({ userId, bookId, chapterId, lastOpenedAt: new Date() })
    .onConflictDoUpdate({
      target: [readingProgress.userId, readingProgress.bookId],
      set: { chapterId, lastOpenedAt: new Date() },
    })

  return { success: true, data: undefined }
}

export async function getReadingProgressAction(
  bookId: string
): Promise<ActionResult<ReadingProgressResult>> {
  const userId = await requireAuth()

  const [progress] = await db
    .select()
    .from(readingProgress)
    .where(and(eq(readingProgress.userId, userId), eq(readingProgress.bookId, bookId)))
    .limit(1)

  if (!progress || !progress.chapterId) {
    return { success: true, data: { lastChapterId: null, readChapterBinderItemIds: [] } }
  }

  // Find the chapter's binderItem to get its order position
  const [currentChapter] = await db
    .select({ binderItemId: chapters.binderItemId })
    .from(chapters)
    .where(eq(chapters.id, progress.chapterId))
    .limit(1)

  if (!currentChapter?.binderItemId) {
    return { success: true, data: { lastChapterId: progress.chapterId, readChapterBinderItemIds: [] } }
  }

  // Get all chapter binder items in order
  const allChapterItems = await db
    .select({ id: binderItems.id, order: binderItems.order })
    .from(binderItems)
    .where(and(eq(binderItems.bookId, bookId), eq(binderItems.type, 'chapter')))
    .orderBy(asc(binderItems.order))

  const currentIndex = allChapterItems.findIndex(item => item.id === currentChapter.binderItemId)
  const readIds = currentIndex >= 0
    ? allChapterItems.slice(0, currentIndex).map(item => item.id)
    : []

  return {
    success: true,
    data: { lastChapterId: progress.chapterId, readChapterBinderItemIds: readIds },
  }
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/actions/reading.actions.ts
git commit -m "feat: reading progress server actions"
```

---

## Task 4: Feed Page + Components

**Files:**
- Delete: `app/[locale]/(app)/discover/page.tsx`
- Create: `app/[locale]/(public)/discover/page.tsx`
- Create: `app/[locale]/(public)/discover/_components/feed-filters.tsx`
- Create: `app/[locale]/(public)/discover/_components/book-card.tsx`
- Create: `app/[locale]/(public)/discover/_components/writers-strip.tsx`
- Create: `app/[locale]/(public)/discover/_components/load-more-feed.tsx`

- [ ] **Step 1: Delete the old stub**

```bash
rm "app/[locale]/(app)/discover/page.tsx"
```

Then confirm the directory is empty and remove it:
```bash
Remove-Item -Path "app/[locale]/(app)/discover" -Recurse
```

- [ ] **Step 2: Write `feed-filters.tsx`**

Client component. Reads `sort` and `genre` from the URL via `useSearchParams` and updates them via `useRouter`.

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

const GENRES = ['Fantasy', 'Sci-Fi', 'Romance', 'Thriller', 'Horror', 'Mystery', 'Literary', 'Historical']

const SORT_LABELS: Record<string, { label: string; description: string }> = {
  trending: { label: '🔥 Trending', description: 'Books gaining the most likes and readers this week' },
  popular: { label: '⭐ Popular', description: 'All-time community favorites' },
  new: { label: '✨ New', description: 'Freshest uploads — straight from the hive' },
}

type Props = {
  currentSort: string
  currentGenre: string | undefined
}

export function FeedFilters({ currentSort, currentGenre }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === null) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      params.delete('page') // reset to page 1 on filter change
      router.push(`/discover?${params.toString()}`)
    },
    [router, searchParams]
  )

  const sortInfo = SORT_LABELS[currentSort] ?? SORT_LABELS.trending

  return (
    <div>
      {/* Filter bar */}
      <div className="px-6 py-4 flex items-center gap-3 flex-wrap border-b border-[#2a2a2a]">
        {/* Sort toggle */}
        <div className="flex bg-[#1e1e1e] border border-[#2a2a2a] rounded-md overflow-hidden shrink-0">
          {Object.entries(SORT_LABELS).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => setParam('sort', key)}
              className={`px-4 py-1.5 text-xs font-medium border-l border-[#2a2a2a] first:border-l-0 transition-colors cursor-pointer ${
                currentSort === key
                  ? 'bg-[#FFC300] text-black font-semibold'
                  : 'bg-transparent text-[#888] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-[#2a2a2a] shrink-0" />

        {/* Genre pills */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setParam('genre', null)}
            className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
              !currentGenre ? 'bg-[#FFC300] text-black font-semibold' : 'bg-[#2a2a2a] text-[#aaa] hover:text-white'
            }`}
          >
            All Genres
          </button>
          {GENRES.map(genre => (
            <button
              key={genre}
              onClick={() => setParam('genre', genre.toLowerCase())}
              className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer ${
                currentGenre === genre.toLowerCase()
                  ? 'bg-[#FFC300] text-black font-semibold'
                  : 'bg-[#2a2a2a] text-[#aaa] hover:text-white'
              }`}
            >
              {currentGenre === genre.toLowerCase() ? `${genre} ✕` : genre}
            </button>
          ))}
        </div>
      </div>

      {/* Context label */}
      <div className="px-6 py-2.5 bg-[#181818] border-b border-[#2a2a2a]">
        <p className="text-xs text-[#888]">
          <span className="text-[#aaa] font-medium">{sortInfo.label}</span> — {sortInfo.description}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `book-card.tsx`**

```tsx
import Link from 'next/link'
import type { DiscoverBook } from '@/lib/actions/discover.actions'

type Props = { book: DiscoverBook }

export function BookCard({ book }: Props) {
  const wordCountFormatted =
    book.wordCount >= 1000
      ? `${Math.round(book.wordCount / 1000)}k words`
      : `${book.wordCount} words`

  return (
    <Link href={`/discover/book/${book.id}`} className="block group">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden hover:border-[#3a3a3a] transition-colors">
        {/* Cover */}
        <div className="aspect-[2/3] bg-gradient-to-br from-[#1e1e1e] to-[#2a2a2a] relative flex items-end p-2">
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={book.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : null}
          {book.genre && (
            <span className="relative z-10 text-[10px] text-[#aaa] bg-black/60 px-1.5 py-0.5 rounded">
              {book.genre}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-2.5">
          <p className="text-white text-[13px] font-semibold leading-snug line-clamp-2 mb-0.5">{book.title}</p>
          <p className="text-[#666] text-[11px] mb-2">
            by {book.authorDisplayName ?? book.authorUsername}
          </p>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-[#555]">{wordCountFormatted}</span>
            <div className="flex gap-2 text-[11px] text-[#555]">
              <span>♥ {book.likeCount}</span>
              <span>🔖 {book.bookmarkCount}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Write `writers-strip.tsx`**

```tsx
import type { DiscoverWriter } from '@/lib/actions/discover.actions'

type Props = { writers: DiscoverWriter[] }

export function WritersStrip({ writers }: Props) {
  if (writers.length === 0) return null

  return (
    <div className="border border-[#2a2a2a] rounded-lg p-4">
      <p className="text-[#888] text-[11px] uppercase tracking-widest mb-3">Writers to Follow</p>
      <div className="flex gap-4">
        {writers.map(writer => (
          <div key={writer.userId} className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#2a2a2a] shrink-0 overflow-hidden flex items-center justify-center text-sm">
              {writer.avatarUrl ? (
                <img src={writer.avatarUrl} alt={writer.username ?? ''} className="w-full h-full object-cover" />
              ) : '✍'}
            </div>
            <div className="min-w-0">
              <p className="text-white text-[13px] truncate">{writer.displayName ?? writer.username}</p>
              <p className="text-[#666] text-[11px]">{writer.bookCount} book{writer.bookCount !== 1 ? 's' : ''}</p>
            </div>
            <button className="ml-auto shrink-0 px-3 py-1 bg-transparent border border-[#2a2a2a] text-[#aaa] rounded text-[11px] hover:border-[#3a3a3a] hover:text-white transition-colors cursor-pointer">
              + Follow
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write `load-more-feed.tsx`**

Client component that holds accumulated book list and fetches more on click.

```tsx
'use client'

import { useState, useTransition } from 'react'
import { getDiscoverFeedAction } from '@/lib/actions/discover.actions'
import { BookCard } from './book-card'
import type { DiscoverBook } from '@/lib/actions/discover.actions'

type Props = {
  initialBooks: DiscoverBook[]
  initialHasMore: boolean
  sort: string
  genre: string | undefined
}

export function LoadMoreFeed({ initialBooks, initialHasMore, sort, genre }: Props) {
  const [books, setBooks] = useState(initialBooks)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()

  const loadMore = () => {
    startTransition(async () => {
      const nextPage = page + 1
      const result = await getDiscoverFeedAction(
        sort as 'trending' | 'popular' | 'new',
        genre,
        nextPage
      )
      if (result.success) {
        setBooks(prev => [...prev, ...result.data.books])
        setHasMore(result.data.hasMore)
        setPage(nextPage)
      }
    })
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-4">
        {books.map(book => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={isPending}
            className="px-8 py-2.5 bg-transparent border border-[#2a2a2a] text-[#888] rounded-md text-[13px] hover:border-[#3a3a3a] hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? 'Loading…' : 'Load more books'}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Write the feed page**

```tsx
import { getDiscoverFeedAction, getDiscoverWritersAction } from '@/lib/actions/discover.actions'
import { FeedFilters } from './_components/feed-filters'
import { WritersStrip } from './_components/writers-strip'
import { LoadMoreFeed } from './_components/load-more-feed'

type Props = {
  searchParams: Promise<{ sort?: string; genre?: string; page?: string }>
}

export default async function DiscoverPage({ searchParams }: Props) {
  const params = await searchParams
  const sort = (params.sort === 'popular' || params.sort === 'new') ? params.sort : 'trending'
  const genre = params.genre

  const [feedResult, writersResult] = await Promise.all([
    getDiscoverFeedAction(sort, genre, 1),
    getDiscoverWritersAction(),
  ])

  const books = feedResult.success ? feedResult.data.books : []
  const hasMore = feedResult.success ? feedResult.data.hasMore : false
  const writers = (writersResult.success && !genre) ? writersResult.data : []

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Page header */}
      <div className="px-6 pt-8 pb-0">
        <h1 className="text-2xl font-semibold text-white mb-1">Discover</h1>
        <p className="text-[#666] text-[13px]">Explore books and writers from the Hive</p>
      </div>

      {/* Filters — client component, needs Suspense for useSearchParams */}
      <div className="mt-4">
        <FeedFilters currentSort={sort} currentGenre={genre} />
      </div>

      {/* Main content */}
      <div className="px-6 py-5">
        {books.length === 0 ? (
          <div className="text-center py-20 text-[#555]">
            No books found for this filter.
          </div>
        ) : (
          <LoadMoreFeed
            initialBooks={books}
            initialHasMore={hasMore}
            sort={sort}
            genre={genre}
          />
        )}

        {/* Writers strip — hidden when genre filter is active */}
        {writers.length > 0 && (
          <div className="mt-6">
            <WritersStrip writers={writers} />
          </div>
        )}
      </div>
    </div>
  )
}
```

`FeedFilters` uses `useSearchParams` which requires Suspense. Wrap the page export in a Suspense boundary by adding to the page file:

```tsx
import { Suspense } from 'react'

// Replace the FeedFilters usage with:
<Suspense fallback={<div className="h-[88px] border-b border-[#2a2a2a]" />}>
  <FeedFilters currentSort={sort} currentGenre={genre} />
</Suspense>
```

- [ ] **Step 7: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add "app/[locale]/(public)/discover/"
git commit -m "feat: discover feed page, book cards, filters, load more, writers strip"
```

---

## Task 5: Book Detail Page + Components

**Files:**
- Create: `app/[locale]/(public)/discover/book/[bookId]/page.tsx`
- Create: `app/[locale]/(public)/discover/_components/chapter-list.tsx`
- Create: `app/[locale]/(public)/discover/_components/comments-panel.tsx`
- Create: `app/[locale]/(public)/discover/_components/social-actions.tsx`

- [ ] **Step 1: Write `chapter-list.tsx`**

Receives the ordered chapter items and read status, shows first 5 with expand. Read status inferred from reading progress.

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

type ChapterItem = {
  binderItemId: string
  chapterId: string
  title: string
  wordCount: number
  order: number
}

type Props = {
  bookId: string
  chapters: ChapterItem[]
  currentChapterId: string | null
  readChapterBinderItemIds: string[]
}

export function ChapterList({ bookId, chapters, currentChapterId, readChapterBinderItemIds }: Props) {
  const [expanded, setExpanded] = useState(false)
  const visibleChapters = expanded ? chapters : chapters.slice(0, 5)
  const remaining = chapters.length - 5

  return (
    <div>
      <p className="text-[#666] text-[11px] uppercase tracking-widest mb-3">Chapters</p>
      <div className="flex flex-col gap-0.5">
        {visibleChapters.map((ch, i) => {
          const isRead = readChapterBinderItemIds.includes(ch.binderItemId)
          const isCurrent = currentChapterId === ch.chapterId

          return (
            <Link
              key={ch.chapterId}
              href={`/discover/book/${bookId}/read/${ch.chapterId}`}
              className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-[13px] transition-colors ${
                isCurrent ? 'bg-[#1e1e1e]' : 'hover:bg-[#1a1a1a]'
              }`}
            >
              <span className="text-[#555] text-[11px] w-5 shrink-0">{i + 1}</span>
              <span className="text-[#aaa] flex-1 truncate">{ch.title}</span>
              <span className="text-[#555] text-[11px] shrink-0">
                {ch.wordCount >= 1000 ? `${Math.round(ch.wordCount / 1000)}k` : ch.wordCount}w
              </span>
              {isRead && <span className="text-[#FFC300] text-[10px] shrink-0">✓ Read</span>}
              {isCurrent && !isRead && <span className="text-[#888] text-[10px] shrink-0">Reading</span>}
            </Link>
          )
        })}
        {!expanded && remaining > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[#555] text-[12px] py-2 text-center hover:text-[#888] transition-colors cursor-pointer"
          >
            + {remaining} more chapter{remaining !== 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `social-actions.tsx`**

Client component. Receives initial state, calls server actions on click, updates optimistically.

```tsx
'use client'

import { useState, useTransition } from 'react'
import { toggleBookLikeAction, toggleBookmarkAction, toggleFollowAction } from '@/lib/actions/social.actions'

type Props = {
  bookId: string
  authorUserId: string
  initialLiked: boolean
  initialBookmarked: boolean
  initialFollowing: boolean
  initialLikeCount: number
  isAuthenticated: boolean
}

export function SocialActions({
  bookId,
  authorUserId,
  initialLiked,
  initialBookmarked,
  initialFollowing,
  initialLikeCount,
  isAuthenticated,
}: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [following, setFollowing] = useState(initialFollowing)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [isPending, startTransition] = useTransition()

  const handleLike = () => {
    if (!isAuthenticated) return
    const next = !liked
    setLiked(next)
    setLikeCount(c => c + (next ? 1 : -1))
    startTransition(async () => {
      const result = await toggleBookLikeAction(bookId)
      if (!result.success) {
        setLiked(!next)
        setLikeCount(c => c + (next ? -1 : 1))
      }
    })
  }

  const handleBookmark = () => {
    if (!isAuthenticated) return
    const next = !bookmarked
    setBookmarked(next)
    startTransition(async () => {
      const result = await toggleBookmarkAction(bookId)
      if (!result.success) setBookmarked(!next)
    })
  }

  const handleFollow = () => {
    if (!isAuthenticated) return
    const next = !following
    setFollowing(next)
    startTransition(async () => {
      const result = await toggleFollowAction(authorUserId)
      if (!result.success) setFollowing(!next)
    })
  }

  if (!isAuthenticated) {
    return (
      <div className="flex gap-2.5 mt-4 items-center">
        <a
          href="/sign-in"
          className="px-5 py-2.5 bg-[#FFC300] text-black font-bold rounded-md text-sm"
        >
          Start Reading →
        </a>
        <p className="text-[#555] text-xs">Sign in to like, bookmark, and follow</p>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5 mt-4 items-center flex-wrap">
      <button
        onClick={handleLike}
        disabled={isPending}
        className={`px-5 py-2.5 rounded-md text-sm font-bold transition-colors cursor-pointer ${
          liked ? 'bg-[#FFC300] text-black' : 'bg-transparent border border-[#2a2a2a] text-[#aaa] hover:text-white'
        }`}
      >
        ♥ {liked ? 'Liked' : 'Like'} · {likeCount}
      </button>
      <button
        onClick={handleBookmark}
        disabled={isPending}
        className={`px-4 py-2.5 rounded-md text-sm transition-colors cursor-pointer ${
          bookmarked ? 'bg-[#2a2a2a] text-[#FFC300]' : 'bg-transparent border border-[#2a2a2a] text-[#aaa] hover:text-white'
        }`}
      >
        🔖 {bookmarked ? 'Bookmarked' : 'Bookmark'}
      </button>
      <button
        onClick={handleFollow}
        disabled={isPending}
        className={`px-4 py-2.5 rounded-md text-sm transition-colors cursor-pointer ${
          following ? 'bg-[#2a2a2a] text-[#FFC300]' : 'bg-transparent border border-[#2a2a2a] text-[#aaa] hover:text-white'
        }`}
      >
        {following ? '✓ Following' : '+ Follow'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Write `comments-panel.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { addCommentAction } from '@/lib/actions/social.actions'
import type { BookComment } from '@/lib/actions/discover.actions'

type Props = {
  bookId: string
  initialComments: BookComment[]
  initialHasMore: boolean
  isAuthenticated: boolean
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function CommentsPanel({ bookId, initialComments, initialHasMore, isAuthenticated }: Props) {
  const [comments, setComments] = useState(initialComments)
  const [draft, setDraft] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!draft.trim() || !isAuthenticated) return
    setError(null)
    const content = draft.trim()
    setDraft('')
    startTransition(async () => {
      const result = await addCommentAction(bookId, content)
      if (result.success) {
        setComments(prev => [result.data, ...prev])
      } else {
        setError('Failed to post comment.')
        setDraft(content)
      }
    })
  }

  return (
    <div>
      <p className="text-[#666] text-[11px] uppercase tracking-widest mb-3">
        Comments · {comments.length}
      </p>

      {isAuthenticated ? (
        <div className="flex gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-full bg-[#2a2a2a] shrink-0" />
          <div className="flex-1">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              maxLength={1000}
              className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-md px-2.5 py-1.5 text-[#aaa] text-[12px] resize-none focus:outline-none focus:border-[#3a3a3a]"
            />
            {error && <p className="text-red-400 text-[11px] mt-1">{error}</p>}
            <button
              onClick={submit}
              disabled={isPending || !draft.trim()}
              className="mt-1.5 px-3 py-1 bg-[#FFC300] text-black text-[11px] font-semibold rounded disabled:opacity-40 cursor-pointer"
            >
              Post
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[#555] text-[12px] mb-4">
          <a href="/sign-in" className="text-[#FFC300]">Sign in</a> to leave a comment.
        </p>
      )}

      <div className="flex flex-col gap-3.5">
        {comments.map(comment => (
          <div key={comment.id} className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#2a2a2a] shrink-0 overflow-hidden flex items-center justify-center text-[11px]">
              {comment.authorAvatarUrl ? (
                <img src={comment.authorAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : '✍'}
            </div>
            <div>
              <p className="text-[12px] mb-0.5">
                <strong className="text-[#aaa]">{comment.authorDisplayName ?? comment.authorUsername}</strong>
                {' '}
                <span className="text-[#555] text-[11px]">{timeAgo(comment.createdAt)}</span>
              </p>
              <p className="text-[#777] text-[12px] leading-relaxed">{comment.content}</p>
            </div>
          </div>
        ))}
        {initialHasMore && (
          <p className="text-[#555] text-[12px] text-center pt-1 cursor-pointer hover:text-[#888]">
            Show more comments
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write the book detail page**

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPublicBookAction } from '@/lib/actions/discover.actions'
import { getBookCommentsAction } from '@/lib/actions/discover.actions'
import { getReadingProgressAction } from '@/lib/actions/reading.actions'
import { getUserSocialStateAction } from '@/lib/actions/social.actions'
import { ChapterList } from '../../_components/chapter-list'
import { CommentsPanel } from '../../_components/comments-panel'
import { SocialActions } from '../../_components/social-actions'
import { db } from '@/db'
import { binderItems, chapters } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

type Props = { params: Promise<{ bookId: string }> }

export default async function BookDetailPage({ params }: Props) {
  const { bookId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id ?? null

  const bookResult = await getPublicBookAction(bookId)
  if (!bookResult.success) notFound()
  const book = bookResult.data

  // Fetch chapter list (binder items of type 'chapter' joined with chapters)
  const chapterRows = await db
    .select({
      binderItemId: binderItems.id,
      chapterId: chapters.id,
      title: binderItems.title,
      wordCount: chapters.wordCount,
      order: binderItems.order,
    })
    .from(binderItems)
    .innerJoin(chapters, eq(chapters.binderItemId, binderItems.id))
    .where(and(eq(binderItems.bookId, bookId), eq(binderItems.type, 'chapter')))
    .orderBy(asc(binderItems.order))

  const [commentsResult, progressResult, socialResult] = await Promise.all([
    getBookCommentsAction(bookId, 1),
    userId ? getReadingProgressAction(bookId) : Promise.resolve(null),
    userId ? getUserSocialStateAction(bookId, book.authorUserId) : Promise.resolve(null),
  ])

  const comments = commentsResult.success ? commentsResult.data.comments : []
  const commentsHasMore = commentsResult.success ? commentsResult.data.hasMore : false
  const progress = progressResult?.success ? progressResult.data : null
  const social = socialResult?.success ? socialResult.data : null

  const progressPercent = progress && chapterRows.length > 0
    ? Math.round((progress.readChapterBinderItemIds.length / chapterRows.length) * 100)
    : 0

  // Find last-read chapter for "Continue" link
  const lastReadChapter = progress?.lastChapterId
    ? chapterRows.find(ch => ch.chapterId === progress.lastChapterId)
    : null

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Nav */}
      <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 py-3 flex items-center gap-3">
        <Link href="/discover" className="text-[#888] text-[13px] hover:text-white transition-colors">
          ← Discover
        </Link>
      </div>

      {/* Hero */}
      <div className="px-6 py-7 grid gap-6 border-b border-[#2a2a2a]" style={{ gridTemplateColumns: '160px 1fr' }}>
        {/* Cover */}
        <div className="aspect-[2/3] bg-gradient-to-br from-[#1e1e1e] to-[#2a2a2a] rounded-md relative flex items-end p-2.5 shrink-0">
          {book.coverUrl && (
            <img src={book.coverUrl} alt={book.title} className="absolute inset-0 w-full h-full object-cover rounded-md" />
          )}
          {book.genre && (
            <span className="relative z-10 text-[11px] text-[#aaa] bg-black/60 px-2 py-0.5 rounded">
              {book.genre}
            </span>
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-col justify-between">
          <div>
            <h1 className="text-white text-[26px] font-semibold leading-tight mb-1">{book.title}</h1>
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-6 h-6 rounded-full bg-[#2a2a2a] shrink-0 overflow-hidden flex items-center justify-center text-[11px]">
                {book.authorAvatarUrl ? (
                  <img src={book.authorAvatarUrl} alt="" className="w-full h-full object-cover" />
                ) : '✍'}
              </div>
              <span className="text-[#aaa] text-[13px]">
                by <span className="text-[#FFC300]">{book.authorDisplayName ?? book.authorUsername}</span>
              </span>
            </div>

            {/* Tags */}
            {book.tags && book.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-3.5">
                {book.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-0.5 bg-[#2a2a2a] text-[#aaa] rounded-full text-[11px]">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="flex gap-5 mb-4">
              {[
                { label: 'Words', value: book.wordCount >= 1000 ? `${Math.round(book.wordCount / 1000)}k` : book.wordCount },
                { label: 'Chapters', value: book.chapterCount },
                { label: 'Likes', value: book.likeCount },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[#555] text-[10px] uppercase tracking-wide">{label}</p>
                  <p className="text-[#aaa] text-[14px] font-semibold mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Synopsis */}
            {book.synopsis && (
              <p className="text-[#888] text-[13px] leading-relaxed max-w-xl">{book.synopsis}</p>
            )}
          </div>

          {/* Start Reading + social actions */}
          <div className="mt-4 flex items-center gap-2.5 flex-wrap">
            {chapterRows[0] && (
              <Link
                href={`/discover/book/${bookId}/read/${lastReadChapter?.chapterId ?? chapterRows[0].chapterId}`}
                className="px-6 py-2.5 bg-[#FFC300] text-black font-bold rounded-md text-[14px] hover:bg-yellow-400 transition-colors"
              >
                {lastReadChapter ? 'Continue Reading →' : 'Start Reading →'}
              </Link>
            )}
            {userId && social ? (
              <SocialActions
                bookId={bookId}
                authorUserId={book.authorUserId}
                initialLiked={social.liked}
                initialBookmarked={social.bookmarked}
                initialFollowing={social.following}
                initialLikeCount={book.likeCount}
                isAuthenticated={true}
              />
            ) : (
              <SocialActions
                bookId={bookId}
                authorUserId={book.authorUserId}
                initialLiked={false}
                initialBookmarked={false}
                initialFollowing={false}
                initialLikeCount={book.likeCount}
                isAuthenticated={false}
              />
            )}
          </div>
        </div>
      </div>

      {/* Reading progress bar */}
      {progress?.lastChapterId && (
        <div className="px-6 py-3 bg-[#181818] border-b border-[#2a2a2a] flex items-center gap-3">
          <span className="text-[#888] text-[12px] shrink-0">Your progress</span>
          <div className="flex-1 h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FFC300] rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {lastReadChapter && (
            <Link
              href={`/discover/book/${bookId}/read/${lastReadChapter.chapterId}`}
              className="text-[#888] text-[12px] shrink-0 hover:text-white transition-colors"
            >
              Ch {chapterRows.findIndex(c => c.chapterId === lastReadChapter.chapterId) + 1} of {chapterRows.length} · Continue →
            </Link>
          )}
        </div>
      )}

      {/* Chapter list + Comments */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 340px' }}>
        <div className="p-6 border-r border-[#2a2a2a]">
          <ChapterList
            bookId={bookId}
            chapters={chapterRows}
            currentChapterId={progress?.lastChapterId ?? null}
            readChapterBinderItemIds={progress?.readChapterBinderItemIds ?? []}
          />
        </div>
        <div className="p-5">
          <CommentsPanel
            bookId={bookId}
            initialComments={comments}
            initialHasMore={commentsHasMore}
            isAuthenticated={!!userId}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(public)/discover/book/" "app/[locale]/(public)/discover/_components/"
git commit -m "feat: book detail page with chapter list, social actions, comments"
```

---

## Task 6: Chapter Reader Page

**Files:**
- Create: `app/[locale]/(public)/discover/book/[bookId]/read/[chapterId]/page.tsx`

The chapter content is TipTap JSON stored in `chapters.content`. Render it using `tiptapToHtml` from `lib/export/tiptap-to-html.ts`.

- [ ] **Step 1: Write the chapter reader page**

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/db'
import { chapters, binderItems, books } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { tiptapToHtml } from '@/lib/export/tiptap-to-html'
import { markChapterReadAction } from '@/lib/actions/reading.actions'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

type Props = { params: Promise<{ bookId: string; chapterId: string }> }

export default async function ChapterReaderPage({ params }: Props) {
  const { bookId, chapterId } = await params

  // Verify book is public
  const [book] = await db
    .select({ id: books.id, title: books.title, status: books.status, visibility: books.visibility })
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1)

  if (!book || book.status !== 'PUBLISHED' || book.visibility !== 'PUBLIC') notFound()

  // Fetch all chapter binder items for navigation
  const allChapters = await db
    .select({
      binderItemId: binderItems.id,
      chapterId: chapters.id,
      title: binderItems.title,
      order: binderItems.order,
    })
    .from(binderItems)
    .innerJoin(chapters, eq(chapters.binderItemId, binderItems.id))
    .where(and(eq(binderItems.bookId, bookId), eq(binderItems.type, 'chapter')))
    .orderBy(asc(binderItems.order))

  const currentIndex = allChapters.findIndex(ch => ch.chapterId === chapterId)
  if (currentIndex === -1) notFound()

  // Fetch chapter content
  const [chapter] = await db
    .select({ content: chapters.content, wordCount: chapters.wordCount })
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .limit(1)

  if (!chapter) notFound()

  const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null
  const nextChapter = currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null
  const current = allChapters[currentIndex]
  const chapterNumber = currentIndex + 1
  const totalChapters = allChapters.length
  const progressPercent = Math.round((chapterNumber / totalChapters) * 100)

  // Mark chapter as read for authenticated users
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user?.id) {
    await markChapterReadAction(bookId, chapterId)
  }

  const htmlContent = chapter.content ? tiptapToHtml(chapter.content) : ''

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Top bar */}
      <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-6 py-2.5 flex items-center justify-between sticky top-0 z-10">
        <Link
          href={`/discover/book/${bookId}`}
          className="text-[#888] text-[13px] hover:text-white transition-colors"
        >
          ← {book.title}
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[#555] text-[12px]">Ch {chapterNumber} of {totalChapters}</span>
          <div className="w-20 h-0.5 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div className="h-full bg-[#FFC300] rounded-full" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Like and bookmark are handled on book detail — keep reader minimal */}
          <Link
            href={`/discover/book/${bookId}`}
            className="px-3 py-1 bg-transparent border border-[#2a2a2a] text-[#888] rounded text-[12px] hover:text-white transition-colors"
          >
            ♥ Like book
          </Link>
        </div>
      </div>

      {/* Chapter content */}
      <div className="max-w-[640px] mx-auto px-6 py-12">
        <p className="text-[#555] text-[12px] uppercase tracking-widest mb-1.5">Chapter {chapterNumber}</p>
        <h2 className="text-white text-[24px] font-semibold mb-9">{current.title}</h2>
        <div
          className="prose-chapter text-[#ccc] text-[16px] leading-[1.9]"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>

      {/* Footer nav */}
      <div className="border-t border-[#2a2a2a] px-6 py-4 flex items-center justify-between bg-[#1a1a1a]">
        {prevChapter ? (
          <Link
            href={`/discover/book/${bookId}/read/${prevChapter.chapterId}`}
            className="px-4 py-2 bg-transparent border border-[#2a2a2a] text-[#888] rounded-md text-[13px] hover:text-white transition-colors"
          >
            ← {prevChapter.title}
          </Link>
        ) : (
          <Link
            href={`/discover/book/${bookId}`}
            className="px-4 py-2 bg-transparent border border-[#2a2a2a] text-[#888] rounded-md text-[13px] hover:text-white transition-colors"
          >
            ← Back to book
          </Link>
        )}
        <div className="text-center">
          <p className="text-[#555] text-[11px]">
            {chapter.wordCount.toLocaleString()} words
          </p>
        </div>
        {nextChapter ? (
          <Link
            href={`/discover/book/${bookId}/read/${nextChapter.chapterId}`}
            className="px-4 py-2 bg-[#FFC300] text-black font-semibold rounded-md text-[13px] hover:bg-yellow-400 transition-colors"
          >
            {nextChapter.title} →
          </Link>
        ) : (
          <Link
            href={`/discover/book/${bookId}`}
            className="px-4 py-2 bg-[#2a2a2a] text-[#aaa] rounded-md text-[13px] hover:text-white transition-colors"
          >
            Finished ✓ Back to book
          </Link>
        )}
      </div>
    </div>
  )
}
```

Add a global CSS rule for the prose-chapter content in `app/globals.css`:

```css
.prose-chapter p { margin-bottom: 1.25rem; }
.prose-chapter h1, .prose-chapter h2, .prose-chapter h3 { color: #fff; margin: 2rem 0 1rem; }
.prose-chapter strong { color: #e0e0e0; }
.prose-chapter em { font-style: italic; }
.prose-chapter blockquote { border-left: 3px solid #2a2a2a; padding-left: 1rem; color: #888; }
.prose-chapter ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1.25rem; }
.prose-chapter ol { list-style: decimal; padding-left: 1.5rem; margin-bottom: 1.25rem; }
.prose-chapter li { margin-bottom: 0.25rem; }
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/(public)/discover/book/[bookId]/read/" app/globals.css
git commit -m "feat: chapter reader with auto-progress tracking and prev/next nav"
```

---

## Self-Review Notes

- `FeedFilters` uses `useSearchParams()` → must be wrapped in `<Suspense>` in the page (noted in Task 4, Step 6).
- `readingProgress` upsert uses `onConflictDoUpdate` — requires Drizzle's conflict target to match the composite PK `(userId, bookId)`. Drizzle syntax: `.onConflictDoUpdate({ target: [readingProgress.userId, readingProgress.bookId], set: {...} })`.
- The "New" sort uses `books.updatedAt` (no `publishedAt` in schema). `publishBookAction` sets `updatedAt: new Date()` so freshly published books will appear first correctly.
- `getBookCommentsAction` filters `parentId IS NULL` — only top-level comments (no threading in v1).
- Chapter reader calls `markChapterReadAction` in the server component render — safe because the page is dynamic (reads session cookies).
- The `authorUsername` field in `DiscoverBook` can be `null` if a user has no profile yet. Fallback to `'unknown'` in the card UI when displaying.
