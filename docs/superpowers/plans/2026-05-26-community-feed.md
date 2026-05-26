# Community Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `/community` page (a redundant public-Hives list) with a logged-in feed of activity from followed writers, plus a right sidebar containing My Hives, suggested writers, and active Sparks.

**Architecture:** A new server-rendered `/community/page.tsx` fetches feed + sidebar data in parallel via four server actions. Main column hosts a `SuggestedWritersStrip` + `FeedList` with three `FeedItem` variants (new_chapter, new_book, new_spark). Right sidebar hosts three panels. No DB migrations.

**Tech Stack:** Next.js 16 App Router (RSC + client components), Drizzle ORM, server actions, lucide-react, Tailwind v4. Builds on existing Phase 6/7 schema: `follows`, `books`, `chapters`, `sparks`, `sparkEntries`, `hives`, `hiveMembers`, `userProfiles`.

**Spec:** [`docs/superpowers/specs/2026-05-26-community-feed-design.md`](../specs/2026-05-26-community-feed-design.md)

---

## File Structure

**Create:**
- `lib/actions/community.actions.ts` — three new server actions (`getCommunityFeedAction`, `getSuggestedWritersAction`, `getMyActiveSparksAction`). One file because they're tightly thematic and small.
- `lib/types/community.ts` — exported types (`FeedItem`, `Writer`, `ActiveSparkEntry`). Keeps the action file slim.
- `app/[locale]/(app)/community/_components/community-page-shell.tsx` — client wrapper providing layout + the "load more" interactivity.
- `app/[locale]/(app)/community/_components/suggested-writers-strip.tsx` — horizontal strip at top of main column.
- `app/[locale]/(app)/community/_components/feed-list.tsx` — list + load more + empty state.
- `app/[locale]/(app)/community/_components/feed-item.tsx` — dispatcher + three variant subcomponents (kept in one file because they share helpers).
- `app/[locale]/(app)/community/_components/sidebar/my-hives-panel.tsx`
- `app/[locale]/(app)/community/_components/sidebar/suggested-writers-panel.tsx`
- `app/[locale]/(app)/community/_components/sidebar/active-sparks-panel.tsx`

**Modify:**
- `app/[locale]/(app)/community/page.tsx` — full rewrite from current 37 lines.

**No tests required** (per spec). All UI integration + DB-dependent server actions.

**No DB migrations.**

---

## Task 1: Types + getCommunityFeedAction

**Files:**
- Create: `lib/types/community.ts`
- Create: `lib/actions/community.actions.ts`

- [ ] **Step 1: Create the types file**

`lib/types/community.ts`:

```ts
export type FeedAuthor = {
  id: string
  username: string
  image: string | null
}

export type NewChapterFeedItem = {
  type: 'new_chapter'
  chapterId: string
  bookId: string
  bookTitle: string
  chapterTitle: string
  chapterNumber: number
  author: FeedAuthor
  publishedAt: Date
}

export type NewBookFeedItem = {
  type: 'new_book'
  bookId: string
  bookTitle: string
  bookCover: string | null
  synopsis: string | null
  author: FeedAuthor
  publishedAt: Date
}

export type NewSparkFeedItem = {
  type: 'new_spark'
  sparkId: string
  sparkPrompt: string
  deadline: Date | null
  author: FeedAuthor
  createdAt: Date
}

export type FeedItem = NewChapterFeedItem | NewBookFeedItem | NewSparkFeedItem

export function feedItemTimestamp(item: FeedItem): Date {
  return item.type === 'new_spark' ? item.createdAt : item.publishedAt
}
```

- [ ] **Step 2: Read existing schema to confirm field shapes**

Before writing the action, READ these files to confirm column names and existence:
- `db/schema/books.ts` — confirm `books.publishedAt`, `books.userId`, `books.coverImage`/`books.cover`, `books.synopsis`, `books.title`.
- `db/schema/binder-items.ts` or `db/schema/chapters.ts` — confirm `chapters.publishedAt` exists OR doesn't (fallback path). Confirm chapter title field (likely `title` or `name` on the binder item, since chapters live as `binderItems` with `type: 'chapter'`).
- `db/schema/social.ts` — confirm `follows.followerId`, `follows.followingId`.
- `db/schema/sparks.ts` — confirm `sparks.creatorId`, `sparks.prompt`, `sparks.createdAt`, `sparks.deadline`.
- `db/schema/users.ts` and `db/schema/user-profiles.ts` — confirm `users.id`, profile fields (`username`, `image`/`avatarUrl`).

If `chapters.publishedAt` does NOT exist, use `binderItems.updatedAt` for chapters under published books as the fallback timestamp (per spec §10). Confirm during this step.

Document findings in a brief note at the top of `community.actions.ts` as a comment.

- [ ] **Step 3: Write `getCommunityFeedAction`**

`lib/actions/community.actions.ts`:

```ts
'use server'

import { db } from '@/db'
import { books, binderItems, sparks, follows, users, userProfiles } from '@/db/schema'
import { and, eq, inArray, sql, gte, desc, lt, or } from 'drizzle-orm'
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

export async function getCommunityFeedAction(args: {
  limit?: number
  cursor?: string | null
} = {}): Promise<ActionResult<{ items: FeedItem[]; nextCursor: string | null }>> {
  const userId = await requireAuth()
  const limit = Math.min(args.limit ?? PAGE_SIZE, 50)
  const cursor = args.cursor ? decodeCursor(args.cursor) : null

  // Step 1: who do I follow?
  const followed = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, userId))
  const followedIds = followed.map(r => r.id)
  if (followedIds.length === 0) {
    return { success: true, data: { items: [], nextCursor: null } }
  }

  const windowStart = new Date(Date.now() - FEED_WINDOW_DAYS * 86_400_000)

  // Step 2: query each source in parallel.
  // Each source returns a unified shape: { item: FeedItem; ts: Date; id: string }.

  const [chapterRows, bookRows, sparkRows] = await Promise.all([
    fetchNewChapters(followedIds, windowStart, limit * 2),
    fetchNewBooks(followedIds, windowStart, limit * 2),
    fetchNewSparks(followedIds, windowStart, limit * 2),
  ])

  // Step 3: merge + sort + paginate.
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
    data: { items: page.map(p => p.item), nextCursor },
  }
}
```

**Sub-helper functions** (define above the export):

```ts
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
      authorImage: userProfiles.image,
    })
    .from(binderItems)
    .innerJoin(books, eq(binderItems.bookId, books.id))
    .innerJoin(users, eq(books.userId, users.id))
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(and(
      eq(binderItems.type, 'chapter'),
      inArray(books.userId, followedIds),
      sql`${books.publishedAt} IS NOT NULL`,
      gte(binderItems.updatedAt, windowStart),
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
      author: { id: r.authorId, username: r.authorUsername, image: r.authorImage },
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
      bookCover: books.coverImage,
      synopsis: books.synopsis,
      publishedAt: books.publishedAt,
      authorId: users.id,
      authorUsername: userProfiles.username,
      authorImage: userProfiles.image,
    })
    .from(books)
    .innerJoin(users, eq(books.userId, users.id))
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(and(
      inArray(books.userId, followedIds),
      sql`${books.publishedAt} IS NOT NULL`,
      gte(books.publishedAt, windowStart),
    ))
    .orderBy(desc(books.publishedAt))
    .limit(limit)

  return rows.map(r => ({
    item: {
      type: 'new_book' as const,
      bookId: r.bookId,
      bookTitle: r.bookTitle,
      bookCover: r.bookCover,
      synopsis: r.synopsis,
      author: { id: r.authorId, username: r.authorUsername, image: r.authorImage },
      publishedAt: r.publishedAt!,
    },
    ts: r.publishedAt!,
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
      prompt: sparks.prompt,
      deadline: sparks.deadline,
      createdAt: sparks.createdAt,
      authorId: users.id,
      authorUsername: userProfiles.username,
      authorImage: userProfiles.image,
    })
    .from(sparks)
    .innerJoin(users, eq(sparks.creatorId, users.id))
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(and(
      inArray(sparks.creatorId, followedIds),
      gte(sparks.createdAt, windowStart),
    ))
    .orderBy(desc(sparks.createdAt))
    .limit(limit)

  return rows.map(r => ({
    item: {
      type: 'new_spark' as const,
      sparkId: r.sparkId,
      sparkPrompt: r.prompt,
      deadline: r.deadline,
      author: { id: r.authorId, username: r.authorUsername, image: r.authorImage },
      createdAt: r.createdAt,
    },
    ts: r.createdAt,
    id: r.sparkId,
  }))
}
```

**Adapt field names based on what Step 2 confirmed.** If `books.coverImage` is actually `books.cover`, change it. If `userProfiles.image` is `userProfiles.avatarUrl`, change it. The structure stays the same.

- [ ] **Step 4: Type check + commit**

```bash
npx tsc --noEmit
```

Expected: clean.

```bash
git add lib/types/community.ts lib/actions/community.actions.ts
git commit -m "feat(community): getCommunityFeedAction + types (Task 1)

Server action that returns a reverse-chronological feed of new
chapters, new books, and new sparks from writers the user follows.
30-day window; UNION-then-merge approach with cursor pagination on
(timestamp, id).

No DB changes. Reads from follows + books + binderItems + sparks +
userProfiles."
```

---

## Task 2: getSuggestedWritersAction + getMyActiveSparksAction

**Files:**
- Modify: `lib/actions/community.actions.ts` (append)
- Modify: `lib/types/community.ts` (append types)

- [ ] **Step 1: Append types**

In `lib/types/community.ts`, add:

```ts
export type SuggestedWriter = {
  id: string
  username: string
  image: string | null
  bio: string | null
  bookCount: number
  isFollowing: boolean
}

export type ActiveSparkEntry = {
  sparkId: string
  sparkPrompt: string
  entryId: string
  status: 'submitted' | 'voting' | 'awaiting_winner' | 'won'
  deadline: Date | null
}
```

- [ ] **Step 2: Append `getSuggestedWritersAction`**

```ts
export async function getSuggestedWritersAction(args: {
  excludeFollowing?: boolean
  limit?: number
} = {}): Promise<ActionResult<SuggestedWriter[]>> {
  const userId = await requireAuth()
  const limit = Math.min(args.limit ?? 5, 20)
  const excludeFollowing = args.excludeFollowing ?? true

  // Followed IDs to exclude
  let excluded: string[] = [userId]
  if (excludeFollowing) {
    const f = await db
      .select({ id: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, userId))
    excluded = excluded.concat(f.map(r => r.id))
  }

  // Active in last 30 days = has any published book updated recently.
  const windowStart = new Date(Date.now() - 30 * 86_400_000)

  const rows = await db
    .select({
      id: users.id,
      username: userProfiles.username,
      image: userProfiles.image,
      bio: userProfiles.bio,
      bookCount: sql<number>`COUNT(${books.id})::int`,
      lastActivity: sql<Date>`MAX(${books.updatedAt})`,
    })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .innerJoin(books, eq(books.userId, users.id))
    .where(and(
      sql`${books.publishedAt} IS NOT NULL`,
      gte(books.updatedAt, windowStart),
      excluded.length > 0 ? sql`${users.id} NOT IN (${sql.join(excluded.map(e => sql`${e}`), sql`,`)})` : sql`TRUE`,
    ))
    .groupBy(users.id, userProfiles.username, userProfiles.image, userProfiles.bio)
    .orderBy(desc(sql`MAX(${books.updatedAt})`))
    .limit(limit)

  return {
    success: true,
    data: rows.map(r => ({
      id: r.id,
      username: r.username,
      image: r.image,
      bio: r.bio,
      bookCount: r.bookCount,
      isFollowing: false,
    })),
  }
}
```

If the SQL `NOT IN` template doesn't work cleanly with Drizzle's `sql.join`, fall back to a JavaScript `.filter()` post-query — fetch a larger pool then filter. The query is small either way.

- [ ] **Step 3: Append `getMyActiveSparksAction`**

```ts
export async function getMyActiveSparksAction(): Promise<ActionResult<ActiveSparkEntry[]>> {
  const userId = await requireAuth()

  // Fetch all my entries with their parent spark info.
  // Filter for non-finalized OR recently-won (within 7 days).
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000)

  const rows = await db
    .select({
      entryId: sparkEntries.id,
      sparkId: sparks.id,
      prompt: sparks.prompt,
      deadline: sparks.deadline,
      winnerEntryId: sparks.winnerEntryId,
      finalizedAt: sparks.finalizedAt,
    })
    .from(sparkEntries)
    .innerJoin(sparks, eq(sparkEntries.sparkId, sparks.id))
    .where(and(
      eq(sparkEntries.authorId, userId),
      or(
        sql`${sparks.winnerEntryId} IS NULL`,
        gte(sparks.finalizedAt ?? sql`NOW()`, sevenDaysAgo),
      ),
    ))
    .orderBy(desc(sparks.createdAt))

  const now = Date.now()
  return {
    success: true,
    data: rows.map(r => {
      let status: ActiveSparkEntry['status']
      if (r.winnerEntryId === r.entryId) status = 'won'
      else if (r.winnerEntryId) return null // somebody else won — don't show
      else if (r.deadline && r.deadline.getTime() > now) status = 'submitted'
      else if (r.deadline && r.deadline.getTime() <= now) status = 'awaiting_winner'
      else status = 'voting'
      return {
        sparkId: r.sparkId,
        sparkPrompt: r.prompt,
        entryId: r.entryId,
        status,
        deadline: r.deadline,
      }
    }).filter((e): e is ActiveSparkEntry => e !== null),
  }
}
```

Confirm field names against `db/schema/sparks.ts` during Step 1 of Task 1. If `sparkEntries.authorId` is `userId` or `entryUserId`, adjust.

- [ ] **Step 4: Type check + commit**

```bash
npx tsc --noEmit
```

```bash
git add lib/actions/community.actions.ts lib/types/community.ts
git commit -m "feat(community): suggested writers + active sparks actions (Task 2)

getSuggestedWritersAction picks up to N users with published books
updated in the last 30 days, excluding self + (optionally) people
already followed.

getMyActiveSparksAction returns the user's open + recently-won spark
entries with computed status (submitted / voting / awaiting_winner /
won)."
```

---

## Task 3: Sidebar panels

**Files:**
- Create: `app/[locale]/(app)/community/_components/sidebar/my-hives-panel.tsx`
- Create: `app/[locale]/(app)/community/_components/sidebar/suggested-writers-panel.tsx`
- Create: `app/[locale]/(app)/community/_components/sidebar/active-sparks-panel.tsx`

- [ ] **Step 1: Identify how to fetch My Hives**

Read `lib/actions/hive.actions.ts`. Confirm whether there's already a `getMyHivesAction()` or similar. If yes, reuse. If not, add one (a thin wrapper around `hiveMembers` joined to `hives` where `userId = me`, returning `{ id, name, memberCount, isPublic }`).

If you add a new action, place it in `lib/actions/hive.actions.ts` (not community.actions.ts — keep hive logic with hives) and commit it as Task 3 Step 1.

- [ ] **Step 2: Create `MyHivesPanel`**

```tsx
// app/[locale]/(app)/community/_components/sidebar/my-hives-panel.tsx
import Link from 'next/link'
import { Users } from 'lucide-react'

type Hive = { id: string; name: string; memberCount: number; isPublic: boolean }

export function MyHivesPanel({ locale, hives }: { locale: string; hives: Hive[] }) {
  const visible = hives.slice(0, 5)
  const hasMore = hives.length > 5

  return (
    <section className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Your Hives</h3>
        <span className="text-xs text-muted-foreground">{hives.length}</span>
      </header>

      {hives.length === 0 ? (
        <div className="flex flex-col gap-2 text-center py-2">
          <p className="text-xs text-muted-foreground">Join or create a Hive to write together.</p>
          <Link
            href={`/${locale}/discover?tab=hives`}
            className="text-xs px-3 py-1.5 rounded bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors inline-block"
          >
            Browse Hives
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map(h => (
            <li key={h.id}>
              <Link
                href={`/${locale}/hive/${h.id}`}
                className="flex items-center justify-between gap-2 text-xs text-foreground hover:text-brand transition-colors"
              >
                <span className="truncate">{h.name}</span>
                <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                  <Users size={10} />
                  {h.memberCount}
                </span>
              </Link>
            </li>
          ))}
          {hasMore && (
            <li>
              <Link href={`/${locale}/discover?tab=hives`} className="text-xs text-brand hover:underline">
                View all ({hives.length})
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Create `SuggestedWritersPanel`**

```tsx
// app/[locale]/(app)/community/_components/sidebar/suggested-writers-panel.tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toggleFollowAction } from '@/lib/actions/social.actions'
import type { SuggestedWriter } from '@/lib/types/community'

export function SuggestedWritersPanel({
  locale,
  writers: initial,
}: {
  locale: string
  writers: SuggestedWriter[]
}) {
  const [writers, setWriters] = useState(initial)

  async function handleFollow(userId: string) {
    // Optimistic update
    setWriters(ws => ws.map(w => w.id === userId ? { ...w, isFollowing: true } : w))
    const result = await toggleFollowAction(userId)
    if (!result.success) {
      // Rollback
      setWriters(ws => ws.map(w => w.id === userId ? { ...w, isFollowing: false } : w))
    }
  }

  if (writers.length === 0) return null

  return (
    <section className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
      <header>
        <h3 className="text-sm font-semibold text-foreground">Discover writers</h3>
      </header>

      <ul className="flex flex-col gap-3">
        {writers.slice(0, 3).map(w => (
          <li key={w.id} className="flex items-center gap-2">
            <Link href={`/${locale}/u/${w.username}`} className="shrink-0">
              {w.image ? (
                <img src={w.image} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <span className="w-8 h-8 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-[11px] font-bold text-brand">
                  {w.username[0]?.toUpperCase() ?? '?'}
                </span>
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <Link
                href={`/${locale}/u/${w.username}`}
                className="text-xs font-medium text-foreground hover:text-brand truncate block"
              >
                @{w.username}
              </Link>
              {w.bio && (
                <p className="text-[10px] text-muted-foreground truncate">{w.bio}</p>
              )}
            </div>
            {!w.isFollowing && (
              <button
                onClick={() => handleFollow(w.id)}
                className="text-[10px] px-2 py-1 rounded bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors shrink-0"
              >
                Follow
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
```

Confirm `toggleFollowAction` import path during implementation — likely `@/lib/actions/social.actions`.

- [ ] **Step 4: Create `ActiveSparksPanel`**

```tsx
// app/[locale]/(app)/community/_components/sidebar/active-sparks-panel.tsx
import Link from 'next/link'
import { Zap } from 'lucide-react'
import type { ActiveSparkEntry } from '@/lib/types/community'

const STATUS_LABEL: Record<ActiveSparkEntry['status'], string> = {
  submitted: 'Submitted',
  voting: 'Voting open',
  awaiting_winner: 'Awaiting winner',
  won: 'Won!',
}

export function ActiveSparksPanel({
  locale,
  entries,
}: {
  locale: string
  entries: ActiveSparkEntry[]
}) {
  return (
    <section className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <Zap size={14} className="text-brand" />
        <h3 className="text-sm font-semibold text-foreground">Your Sparks</h3>
      </header>

      {entries.length === 0 ? (
        <div className="text-center py-2">
          <Link
            href={`/${locale}/discover?tab=sparks`}
            className="text-xs px-3 py-1.5 rounded bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors inline-block"
          >
            Try a Spark
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.slice(0, 3).map(e => (
            <li key={e.entryId}>
              <Link
                href={`/${locale}/discover/spark/${e.sparkId}`}
                className="flex flex-col gap-1 text-xs hover:text-brand transition-colors group"
              >
                <span className="text-foreground truncate group-hover:text-brand">{e.sparkPrompt}</span>
                <span className={`text-[10px] inline-block w-fit px-1.5 py-0.5 rounded border ${
                  e.status === 'won'
                    ? 'bg-brand/20 text-brand border-brand/40'
                    : 'text-muted-foreground border-border'
                }`}>
                  {STATUS_LABEL[e.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Type check + commit**

```bash
npx tsc --noEmit
```

```bash
git add "app/[locale]/(app)/community/_components/sidebar/"
git commit -m "feat(community): sidebar panels — hives, suggested writers, sparks (Task 3)

Three vertical panels rendered in the right sidebar of /community.
Each has an empty-state CTA (browse hives / no panel shown / try a
spark). SuggestedWritersPanel handles optimistic follow toggling
with rollback on failure."
```

---

## Task 4: SuggestedWritersStrip + FeedItem variants

**Files:**
- Create: `app/[locale]/(app)/community/_components/suggested-writers-strip.tsx`
- Create: `app/[locale]/(app)/community/_components/feed-item.tsx`

- [ ] **Step 1: Create `SuggestedWritersStrip`**

```tsx
// app/[locale]/(app)/community/_components/suggested-writers-strip.tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toggleFollowAction } from '@/lib/actions/social.actions'
import type { SuggestedWriter } from '@/lib/types/community'

export function SuggestedWritersStrip({
  locale,
  writers: initial,
}: {
  locale: string
  writers: SuggestedWriter[]
}) {
  const [writers, setWriters] = useState(initial)

  async function handleFollow(userId: string) {
    setWriters(ws => ws.map(w => w.id === userId ? { ...w, isFollowing: true } : w))
    const result = await toggleFollowAction(userId)
    if (!result.success) {
      setWriters(ws => ws.map(w => w.id === userId ? { ...w, isFollowing: false } : w))
    }
  }

  if (writers.length === 0) return null

  return (
    <section className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Writers to follow</h3>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {writers.map(w => (
          <div
            key={w.id}
            className="flex flex-col items-center gap-2 min-w-[120px] bg-background border border-border rounded-md p-3 shrink-0"
          >
            <Link href={`/${locale}/u/${w.username}`}>
              {w.image ? (
                <img src={w.image} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <span className="w-12 h-12 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-sm font-bold text-brand">
                  {w.username[0]?.toUpperCase() ?? '?'}
                </span>
              )}
            </Link>
            <Link
              href={`/${locale}/u/${w.username}`}
              className="text-xs font-medium text-foreground hover:text-brand text-center truncate w-full"
            >
              @{w.username}
            </Link>
            <span className="text-[10px] text-muted-foreground">{w.bookCount} book{w.bookCount !== 1 ? 's' : ''}</span>
            {!w.isFollowing ? (
              <button
                onClick={() => handleFollow(w.id)}
                className="text-[10px] w-full px-2 py-1 rounded bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors"
              >
                Follow
              </button>
            ) : (
              <span className="text-[10px] text-muted-foreground">Following</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create `FeedItem` dispatcher + variants**

```tsx
// app/[locale]/(app)/community/_components/feed-item.tsx
import Link from 'next/link'
import { BookOpen, Zap, BookMarked } from 'lucide-react'
import type { FeedItem, NewChapterFeedItem, NewBookFeedItem, NewSparkFeedItem } from '@/lib/types/community'

function relTime(d: Date): string {
  const seconds = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function AuthorRow({ author, locale, label }: { author: FeedItem['author']; locale: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Link href={`/${locale}/u/${author.username}`} className="shrink-0">
        {author.image ? (
          <img src={author.image} alt="" className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <span className="w-6 h-6 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-[10px] font-bold text-brand">
            {author.username[0]?.toUpperCase() ?? '?'}
          </span>
        )}
      </Link>
      <Link href={`/${locale}/u/${author.username}`} className="text-foreground font-medium hover:text-brand truncate">
        @{author.username}
      </Link>
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}

function NewChapterCard({ item, locale }: { item: NewChapterFeedItem; locale: string }) {
  return (
    <Link
      href={`/${locale}/discover/book/${item.bookId}/read/${item.chapterId}`}
      className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2 hover:bg-surface-elevated transition-colors block"
    >
      <div className="flex items-center justify-between">
        <AuthorRow author={item.author} locale={locale} label="published a chapter" />
        <span className="text-[10px] text-muted-foreground">{relTime(item.publishedAt)}</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <BookOpen size={14} className="text-foreground/60 shrink-0" />
        <p className="text-sm text-foreground">
          <span className="font-medium">Ch. {item.chapterNumber}: {item.chapterTitle}</span>
          <span className="text-muted-foreground"> in </span>
          <span className="font-medium">{item.bookTitle}</span>
        </p>
      </div>
    </Link>
  )
}

function NewBookCard({ item, locale }: { item: NewBookFeedItem; locale: string }) {
  return (
    <Link
      href={`/${locale}/discover/book/${item.bookId}`}
      className="bg-card border border-border rounded-lg p-4 flex gap-4 hover:bg-surface-elevated transition-colors block"
    >
      <div className="w-16 h-24 rounded bg-background border border-border overflow-hidden shrink-0 flex items-center justify-center">
        {item.bookCover ? (
          <img src={item.bookCover} alt="" className="w-full h-full object-cover" />
        ) : (
          <BookMarked size={20} className="text-foreground/30" />
        )}
      </div>
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <AuthorRow author={item.author} locale={locale} label="published a book" />
          <span className="text-[10px] text-muted-foreground shrink-0">{relTime(item.publishedAt)}</span>
        </div>
        <h3 className="text-sm font-semibold text-foreground truncate">{item.bookTitle}</h3>
        {item.synopsis && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.synopsis}</p>
        )}
      </div>
    </Link>
  )
}

function NewSparkCard({ item, locale }: { item: NewSparkFeedItem; locale: string }) {
  const deadlineLabel = item.deadline
    ? (item.deadline.getTime() > Date.now() ? `Ends ${relTime(item.deadline).replace(' ago', '')}` : 'Voting closed')
    : 'No deadline'

  return (
    <Link
      href={`/${locale}/discover/spark/${item.sparkId}`}
      className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2 hover:bg-surface-elevated transition-colors block"
    >
      <div className="flex items-center justify-between">
        <AuthorRow author={item.author} locale={locale} label="started a Spark" />
        <span className="text-[10px] text-muted-foreground">{relTime(item.createdAt)}</span>
      </div>
      <div className="flex items-start gap-2 mt-1">
        <Zap size={14} className="text-brand shrink-0 mt-0.5" />
        <p className="text-sm text-foreground italic">{item.sparkPrompt}</p>
      </div>
      <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 inline-block w-fit">
        {deadlineLabel}
      </span>
    </Link>
  )
}

export function FeedItemRenderer({ item, locale }: { item: FeedItem; locale: string }) {
  switch (item.type) {
    case 'new_chapter': return <NewChapterCard item={item} locale={locale} />
    case 'new_book':    return <NewBookCard item={item} locale={locale} />
    case 'new_spark':   return <NewSparkCard item={item} locale={locale} />
  }
}
```

- [ ] **Step 3: Type check + commit**

```bash
npx tsc --noEmit
```

```bash
git add "app/[locale]/(app)/community/_components/suggested-writers-strip.tsx" "app/[locale]/(app)/community/_components/feed-item.tsx"
git commit -m "feat(community): SuggestedWritersStrip + FeedItem variants (Task 4)

Strip: horizontal scroll of writer cards with optimistic follow.
FeedItem: dispatcher routing to NewChapterCard, NewBookCard,
NewSparkCard — each with author row, click-to-destination, relative
time formatting. No state, pure presentational."
```

---

## Task 5: FeedList + CommunityPageShell + new page.tsx

**Files:**
- Create: `app/[locale]/(app)/community/_components/feed-list.tsx`
- Create: `app/[locale]/(app)/community/_components/community-page-shell.tsx`
- Modify: `app/[locale]/(app)/community/page.tsx` — full rewrite

- [ ] **Step 1: Create `FeedList`**

```tsx
// app/[locale]/(app)/community/_components/feed-list.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FeedItemRenderer } from './feed-item'
import { getCommunityFeedAction } from '@/lib/actions/community.actions'
import type { FeedItem } from '@/lib/types/community'

export function FeedList({
  locale,
  initialItems,
  initialNextCursor,
  hasAnyFollows,
}: {
  locale: string
  initialItems: FeedItem[]
  initialNextCursor: string | null
  hasAnyFollows: boolean
}) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialNextCursor)
  const [loading, setLoading] = useState(false)

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    const result = await getCommunityFeedAction({ cursor })
    setLoading(false)
    if (result.success) {
      setItems(prev => [...prev, ...result.data.items])
      setCursor(result.data.nextCursor)
    }
  }

  if (!hasAnyFollows) {
    return (
      <section className="bg-card border border-border rounded-lg p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Follow writers to fill your feed. Try the suggestions above ↑
        </p>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className="bg-card border border-border rounded-lg p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Nothing new from your follows this week. Try the suggestions above ↑
        </p>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map(item => {
        const key = item.type === 'new_chapter' ? item.chapterId
                  : item.type === 'new_book' ? item.bookId
                  : item.sparkId
        return <FeedItemRenderer key={`${item.type}_${key}`} item={item} locale={locale} />
      })}

      {cursor ? (
        <button
          onClick={loadMore}
          disabled={loading}
          className="text-xs px-4 py-2 rounded border border-border text-foreground hover:bg-surface-elevated transition-colors disabled:opacity-50 self-center"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          You&apos;re caught up — <Link href={`/${locale}/discover`} className="text-brand hover:underline">explore Discover</Link>
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `CommunityPageShell`**

This is the layout wrapper. Server-renderable.

```tsx
// app/[locale]/(app)/community/_components/community-page-shell.tsx
import { SuggestedWritersStrip } from './suggested-writers-strip'
import { FeedList } from './feed-list'
import { MyHivesPanel } from './sidebar/my-hives-panel'
import { SuggestedWritersPanel } from './sidebar/suggested-writers-panel'
import { ActiveSparksPanel } from './sidebar/active-sparks-panel'
import type { FeedItem, SuggestedWriter, ActiveSparkEntry } from '@/lib/types/community'

type Hive = { id: string; name: string; memberCount: number; isPublic: boolean }

export function CommunityPageShell({
  locale,
  feedItems,
  feedCursor,
  hasAnyFollows,
  suggestedWriters,
  myHives,
  activeSparks,
}: {
  locale: string
  feedItems: FeedItem[]
  feedCursor: string | null
  hasAnyFollows: boolean
  suggestedWriters: SuggestedWriter[]
  myHives: Hive[]
  activeSparks: ActiveSparkEntry[]
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6 flex flex-col lg:flex-row gap-6">
      <main className="flex-1 flex flex-col gap-4 min-w-0">
        <SuggestedWritersStrip locale={locale} writers={suggestedWriters} />
        <FeedList
          locale={locale}
          initialItems={feedItems}
          initialNextCursor={feedCursor}
          hasAnyFollows={hasAnyFollows}
        />
      </main>

      <aside className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
        <MyHivesPanel locale={locale} hives={myHives} />
        <SuggestedWritersPanel locale={locale} writers={suggestedWriters.slice(0, 3)} />
        <ActiveSparksPanel locale={locale} entries={activeSparks} />
      </aside>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite `page.tsx`**

```tsx
// app/[locale]/(app)/community/page.tsx
import { getCommunityFeedAction, getSuggestedWritersAction, getMyActiveSparksAction } from '@/lib/actions/community.actions'
import { getMyHivesAction } from '@/lib/actions/hive.actions'
import { CommunityPageShell } from './_components/community-page-shell'

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  const [feedResult, writersResult, hivesResult, sparksResult] = await Promise.all([
    getCommunityFeedAction({ limit: 20 }),
    getSuggestedWritersAction({ excludeFollowing: true, limit: 8 }),
    getMyHivesAction(),
    getMyActiveSparksAction(),
  ])

  const feedItems = feedResult.success ? feedResult.data.items : []
  const feedCursor = feedResult.success ? feedResult.data.nextCursor : null
  const suggestedWriters = writersResult.success ? writersResult.data : []
  const myHives = hivesResult.success ? hivesResult.data : []
  const activeSparks = sparksResult.success ? sparksResult.data : []

  // hasAnyFollows: derive by trying to detect. Cheap heuristic: if feed has items, definitely.
  // For the empty case we need an extra query. Reuse pattern: a hasAnyFollows flag from feed action,
  // OR add a thin getFollowCountAction. For now: if feedResult succeeded AND items.length === 0,
  // we don't know if it's "0 follows" or "follows but no recent content."
  // SIMPLEST FIX: have the feed action return hasAnyFollows in its data object.

  // Adapt the feed action to also return hasAnyFollows so this works:
  // const hasAnyFollows = feedResult.success ? feedResult.data.hasAnyFollows : false

  // For now, treat empty feed as "no follows" if there are no items at all.
  const hasAnyFollows = feedItems.length > 0  // see TODO above

  return (
    <CommunityPageShell
      locale={locale}
      feedItems={feedItems}
      feedCursor={feedCursor}
      hasAnyFollows={hasAnyFollows}
      suggestedWriters={suggestedWriters}
      myHives={myHives}
      activeSparks={activeSparks}
    />
  )
}
```

**ACTION REQUIRED in this step:** modify `getCommunityFeedAction` in Task 1 to also return `hasAnyFollows: boolean`. This avoids an ambiguous empty state. Update the action's return type, the early-return when `followedIds.length === 0` (set `hasAnyFollows: false`), and the normal return (set `hasAnyFollows: true`).

Update `FeedItem` consumers in this page accordingly:
```ts
const hasAnyFollows = feedResult.success ? feedResult.data.hasAnyFollows : false
```

Then update `FeedList`'s `hasAnyFollows` prop wire-up.

- [ ] **Step 4: Type check + commit**

```bash
npx tsc --noEmit
npm test
```

Both clean. Tests stay at 119.

```bash
git add "app/[locale]/(app)/community/" "lib/actions/community.actions.ts"
git commit -m "feat(community): wire feed + sidebar into new /community page (Task 5)

Full rewrite of /community page. Server component fetches feed +
suggested writers + my hives + my active sparks in parallel, then
renders CommunityPageShell with two-column layout.

FeedList handles load-more pagination client-side with optimistic
loading state and 'caught up' message when exhausted.

getCommunityFeedAction now also returns hasAnyFollows so the empty
state can distinguish 'no follows' from 'no recent content'."
```

---

## Task 6: Verification + push

- [ ] **Step 1: Run all checks**

```bash
npx tsc --noEmit
npm test
```

Both clean.

- [ ] **Step 2: Manual checklist (spec §8)**

Walk through the 12 manual checks from the spec:
1. Sign in as user with 3+ follows → feed renders chrono.
2. Click each item type → lands at the right destination.
3. Load more → appends; exhaustible; shows "caught up" link.
4. Sign in as 0-follows user → strip prominent; empty card.
5. Follow from strip → optimistic update; refresh → items appear.
6. My Hives panel works (populated + empty CTA).
7. Suggested writers sidebar works (follow optimistic).
8. Active Sparks panel works (statuses correct).
9. Layout stacks under lg breakpoint.
10. Old /community Hives list is gone.
11. tsc clean.
12. tests clean.

For checks 1-8 that require test data: use the `DEV_FORCE_PREMIUM` pattern as inspiration, but for follows you may need to either manually seed via the UI or have a test account ready. Document any check that can't be fully run and call it out.

- [ ] **Step 3: Update AGENTS.md**

Read AGENTS.md, find the "Phase 7 — Community" section under "What Has Been Built." Append a "Phase 7.5 — Community feed" subsection summarizing:

```markdown
### Phase 7.5 — Community feed ✅ COMPLETE
- Repositioned /community from a redundant Hives list into the user's personal feed of activity from followed writers.
- New page: SuggestedWritersStrip + reverse-chrono FeedList + right sidebar (My Hives, Suggested writers, Active Sparks).
- Three feed item variants: new_chapter, new_book, new_spark — 30-day window.
- New server actions: getCommunityFeedAction, getSuggestedWritersAction, getMyActiveSparksAction.
- No DB migrations.
```

Update the Resume Here block:
- Bump Last updated
- Current focus → next thing (probably back to Claude Design integration prep or Phase 8)
- Last commit → actual most recent
- Next concrete step

- [ ] **Step 4: Commit AGENTS.md + push**

```bash
git add AGENTS.md
git commit -m "docs: close Community feed (Phase 7.5)"
git push origin main
```

---

## Definition of Done

- `/community` page renders the new feed + sidebar shape for authenticated users.
- Three new server actions exist and pass manual smoke tests.
- Old single-page Hives list is fully replaced.
- All 12 manual checklist items pass.
- `npx tsc --noEmit` clean.
- `npm test` clean (still 119 — no new unit tests required).
- ~6 atomic commits on `main` (Tasks 1, 2, 3, 4, 5, AGENTS.md update).
- Pushed to origin.
