# C3 — Reading Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship reading lists — single-owner curated lists of Beehive + external books with `isRead` + commentary + 1-5 rating per book, PUBLIC/FRIENDS/PRIVATE visibility + discoverable, follow-only social, Liked auto-list, feed events with batch dedupe, `/reading-lists` canonical hub + `/discover?tab=lists` discovery surface.

**Architecture:** New tables (`reading_lists`, `reading_list_books`, `reading_list_follows`) + 1 new pgEnum (`reading_list_kind`) + 2 additions to existing `social_activity_type`. Reuses C1 `areFriends` + `isBlocked` helpers + `recordSocialActivityTx` writer + C2 `<VisibilityPicker>` UI shape. New dedupe-with-increment pattern for `books_added_batch` (UPDATE existing `payload.count` via `jsonb_set` instead of skip-write).

**Tech Stack:** Next.js 16 App Router, Drizzle ORM on Neon Postgres, shadcn Dialog + DropdownMenu, dnd-kit for book reorder, sonner toasts, vitest + tsc.

**Spec:** [docs/superpowers/specs/2026-06-04-c3-reading-lists-design.md](../specs/2026-06-04-c3-reading-lists-design.md)
**Phase overview:** [docs/superpowers/specs/2026-06-04-community-phase-overview.md](../specs/2026-06-04-community-phase-overview.md)

---

## Task Dependencies

```
T1 (schema) → T2 (helpers) → T3-T8 (server actions, single shared file)
                                    ↓
                                  T9, T10 (routes) — parallel possible
                                    ↓
                                  T11-T15 (UI) — parallel after routes
                                    ↓
                                  T16 (smoke + ship)
```

Suggested 6-wave shape (matches C2 cadence):
- **W1**: T1 alone (schema migration)
- **W2**: T2 alone (helpers)
- **W3**: T3+T4+T5+T6+T7+T8 as ONE combined commit (single subagent — same file race avoidance as C2 Wave 3)
- **W4**: T9+T10 parallel (different page files)
- **W5**: T11+T12+T13+T14+T15 parallel (isolated component scopes)
- **W6**: T16 smoke + ship

---

## Task 1: Schema migration

**Files:**
- Create: `scripts/migrate-c3.ts`
- Modify: `db/schema/social.ts`

- [ ] **Step 1: Extend `db/schema/social.ts`** — append new pgEnum + 3 tables. Append `'reading_list_created'` + `'books_added_batch'` to the existing `socialActivityTypeEnum` array literal (T1 of C1 lesson — drizzle enum array must match live DB enum order).

```ts
export const readingListKindEnum = pgEnum('reading_list_kind', ['CUSTOM', 'LIKED'])

export type ReadingListKind = (typeof readingListKindEnum.enumValues)[number]

export const readingLists = pgTable(
  'reading_lists',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: readingListKindEnum('kind').notNull().default('CUSTOM'),
    title: text('title').notNull(),
    description: text('description'),
    visibility: bookVisibilityEnum('visibility').notNull().default('PUBLIC'),
    discoverable: boolean('discoverable').notNull().default(true),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    bookCount: integer('book_count').notNull().default(0),
    followerCount: integer('follower_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('reading_lists_user_created_idx').on(t.userId, t.createdAt.desc()),
    index('reading_lists_discoverable_visibility_idx').on(t.discoverable, t.visibility),
  ],
)

export const readingListBooks = pgTable(
  'reading_list_books',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    listId: text('list_id').notNull().references(() => readingLists.id, { onDelete: 'cascade' }),
    bookId: text('book_id').references(() => books.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    author: text('author').notNull(),
    coverUrl: text('cover_url'),
    isRead: boolean('is_read').notNull().default(false),
    rating: integer('rating'),
    commentary: text('commentary'),
    order: integer('order').notNull().default(0),
    addedAt: timestamp('added_at').notNull().defaultNow(),
  },
  (t) => [
    index('reading_list_books_list_order_idx').on(t.listId, t.order),
  ],
)

export const readingListFollows = pgTable(
  'reading_list_follows',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    listId: text('list_id').notNull().references(() => readingLists.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.listId] }),
    index('reading_list_follows_list_idx').on(t.listId),
  ],
)
```

**Confirm:** `bookVisibilityEnum` already exists from books schema. Import it if needed.

- [ ] **Step 2: Create `scripts/migrate-c3.ts`** mirroring `scripts/migrate-c2.ts` shape:

```ts
/**
 * C3 Reading Lists migration:
 *  1. Create reading_list_kind enum.
 *  2. Create reading_lists + 2 indexes.
 *  3. Create reading_list_books + 1 index + 2 CHECK constraints (rating 1-5, commentary <=500).
 *  4. Create reading_list_follows (composite PK) + 1 index.
 *  5. Create partial unique index ON reading_lists(user_id) WHERE kind='LIKED' for ensureLikedListAction.
 *  6. ALTER TYPE social_activity_type ADD VALUE 'reading_list_created'.
 *  7. ALTER TYPE social_activity_type ADD VALUE 'books_added_batch'.
 *  8. Verification row counts.
 *
 * Idempotent. Run: npx dotenv -e .env.local -- tsx scripts/migrate-c3.ts
 */
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Running C3 schema migration...')

  await sql`DO $$ BEGIN
    CREATE TYPE reading_list_kind AS ENUM ('CUSTOM','LIKED');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`
  console.log('✓ 1/8 reading_list_kind enum')

  await sql`CREATE TABLE IF NOT EXISTS reading_lists (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind reading_list_kind NOT NULL DEFAULT 'CUSTOM',
    title text NOT NULL,
    description text,
    visibility book_visibility NOT NULL DEFAULT 'PUBLIC',
    discoverable boolean NOT NULL DEFAULT true,
    tags text[] NOT NULL DEFAULT '{}',
    book_count integer NOT NULL DEFAULT 0,
    follower_count integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`
  await sql`CREATE INDEX IF NOT EXISTS reading_lists_user_created_idx ON reading_lists (user_id, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS reading_lists_discoverable_visibility_idx ON reading_lists (discoverable, visibility)`
  console.log('✓ 2/8 reading_lists table + indexes')

  await sql`CREATE TABLE IF NOT EXISTS reading_list_books (
    id text PRIMARY KEY,
    list_id text NOT NULL REFERENCES reading_lists(id) ON DELETE CASCADE,
    book_id text REFERENCES books(id) ON DELETE SET NULL,
    title text NOT NULL,
    author text NOT NULL,
    cover_url text,
    is_read boolean NOT NULL DEFAULT false,
    rating integer,
    commentary text,
    "order" integer NOT NULL DEFAULT 0,
    added_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT reading_list_books_rating_check CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    CONSTRAINT reading_list_books_commentary_check CHECK (commentary IS NULL OR length(commentary) <= 500)
  )`
  await sql`CREATE INDEX IF NOT EXISTS reading_list_books_list_order_idx ON reading_list_books (list_id, "order")`
  console.log('✓ 3/8 reading_list_books table + index + CHECKs')

  await sql`CREATE TABLE IF NOT EXISTS reading_list_follows (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    list_id text NOT NULL REFERENCES reading_lists(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, list_id)
  )`
  await sql`CREATE INDEX IF NOT EXISTS reading_list_follows_list_idx ON reading_list_follows (list_id)`
  console.log('✓ 4/8 reading_list_follows table + index')

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS reading_lists_user_liked_unique ON reading_lists (user_id) WHERE kind = 'LIKED'`
  console.log('✓ 5/8 partial unique index for Liked auto-list')

  await sql`ALTER TYPE social_activity_type ADD VALUE IF NOT EXISTS 'reading_list_created'`
  console.log('✓ 6/8 social_activity_type += reading_list_created')

  await sql`ALTER TYPE social_activity_type ADD VALUE IF NOT EXISTS 'books_added_batch'`
  console.log('✓ 7/8 social_activity_type += books_added_batch')

  const [{ lists_count }] = await sql`SELECT count(*)::int AS lists_count FROM reading_lists` as any
  const [{ books_count }] = await sql`SELECT count(*)::int AS books_count FROM reading_list_books` as any
  console.log(`✓ 8/8 verification — ${lists_count} lists, ${books_count} books`)

  console.log('\nC3 migration complete.')
}

main().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 3: Run migration**

Run: `npx dotenv -e .env.local -- tsx scripts/migrate-c3.ts`
Expected: 8 ✓ steps. Re-run for idempotency.

- [ ] **Step 4: Tsc + tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean + 502/502 green.

- [ ] **Step 5: Commit**

```bash
git add db/schema/social.ts scripts/migrate-c3.ts
git commit -m "feat(c3/schema): reading_lists + reading_list_books + reading_list_follows tables"
```
(HEREDOC + Co-Authored-By trailer.)

---

## Task 2: Helpers — predicates + liked-list-books + ensure-liked-list

**Files:**
- Create: `lib/reading-lists/predicates.ts`
- Create: `lib/reading-lists/liked-list-books.ts`
- Create: `lib/reading-lists/ensure-liked-list.ts`
- Test: `lib/reading-lists/__tests__/{predicates,liked-list-books,ensure-liked-list}.test.ts`

- [ ] **Step 1: `predicates.ts`** — mirror `lib/sparks/predicates.ts`:

```ts
import { areFriends } from '@/lib/social/are-friends'
import { isBlocked } from '@/lib/social/is-blocked'

type ListLike = { userId: string; visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE' }

export async function canViewList(viewerId: string | null, list: ListLike): Promise<boolean> {
  if (viewerId && (await isBlocked(viewerId, list.userId))) return false
  if (list.visibility === 'PUBLIC') return true
  if (list.visibility === 'PRIVATE') return viewerId === list.userId
  if (!viewerId) return false
  if (viewerId === list.userId) return true
  return await areFriends(viewerId, list.userId)
}

export function canEditList(viewerId: string | null, list: ListLike): boolean {
  return viewerId !== null && viewerId === list.userId
}

export async function canFollowList(viewerId: string | null, list: ListLike): Promise<boolean> {
  if (!viewerId) return false
  if (viewerId === list.userId) return false
  return await canViewList(viewerId, list)
}
```

- [ ] **Step 2: `liked-list-books.ts`** — derive books from `book_likes`:

```ts
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { books, userProfiles } from '@/db/schema'
import { bookLikes } from '@/db/schema/social'

export type DerivedBookRow = {
  id: string                 // synthetic — uses `liked-${bookId}` so UI keys don't collide
  listId: string             // the Liked list's id
  bookId: string
  title: string
  author: string
  coverUrl: string | null
  isRead: boolean            // always false for derived rows
  rating: null
  commentary: null
  order: number              // index by recency
  addedAt: Date              // = bookLikes.createdAt
}

export async function getLikedListBooks(userId: string, likedListId: string): Promise<DerivedBookRow[]> {
  const rows = await db.select({
    bookId: bookLikes.bookId,
    likedAt: bookLikes.createdAt,
    bookTitle: books.title,
    bookCoverUrl: books.coverUrl,
    authorUserId: books.userId,
    authorUsername: userProfiles.username,
    authorDisplayName: userProfiles.displayName,
  })
    .from(bookLikes)
    .innerJoin(books, eq(bookLikes.bookId, books.id))
    .leftJoin(userProfiles, eq(userProfiles.userId, books.userId))
    .where(eq(bookLikes.userId, userId))
    .orderBy(desc(bookLikes.createdAt))

  return rows.map((r, i) => ({
    id: `liked-${r.bookId}`,
    listId: likedListId,
    bookId: r.bookId,
    title: r.bookTitle,
    author: r.authorDisplayName ?? r.authorUsername ?? 'Unknown author',
    coverUrl: r.bookCoverUrl,
    isRead: false,
    rating: null,
    commentary: null,
    order: i,
    addedAt: r.likedAt,
  }))
}
```

- [ ] **Step 3: `ensure-liked-list.ts`**:

```ts
import { db } from '@/db'
import { readingLists } from '@/db/schema/social'
import { createId } from '@paralleldrive/cuid2'

/** Idempotent. Lazy-create the user's Liked auto-list. Returns nothing — failure is best-effort. */
export async function ensureLikedListAction(userId: string): Promise<void> {
  try {
    await db.insert(readingLists).values({
      id: createId(),
      userId,
      kind: 'LIKED',
      title: 'Liked',
      visibility: 'PUBLIC',
      discoverable: false,
    }).onConflictDoNothing()  // relies on partial-unique-index from T1 step 5
  } catch (err) {
    console.warn('[ensureLikedListAction] best-effort failure:', err)
  }
}
```

- [ ] **Step 4: Tests** — mirror C2 T2 pattern with top-level `vi.mock` + static imports.

`predicates.test.ts` (~10 tests covering visibility × block matrix for canViewList + canEditList truth table + canFollowList block + self cases).

`liked-list-books.test.ts` (2-3 tests — empty result; populated result; ordering by recency).

`ensure-liked-list.test.ts` (2 tests — successful insert; conflict-no-op).

- [ ] **Step 5: Tsc + tests + commit**

```bash
npx tsc --noEmit && npm test
git add lib/reading-lists/
git commit -m "feat(c3/helpers): predicates + liked-list-books + ensureLikedListAction"
```

---

## Task 3-8: Server actions (one combined commit per C2 Wave 3 precedent)

**Files:**
- Create: `lib/actions/reading-lists.actions.ts`
- Create: `lib/validations/reading-list.ts`
- Modify: `lib/actions/social.actions.ts` (T8 — extend `toggleBookLikeAction`)
- Modify: `lib/actions/discover.actions.ts` (T7 — add `searchBooksAction`)
- Test: `lib/actions/__tests__/reading-lists-actions.test.ts`

**ALL 6 TASKS BELOW SHIP IN ONE COMMIT** to avoid 6-way race on `reading-lists.actions.ts` (per C2 Wave 3 precedent). Dispatch as ONE combined-implementer subagent.

### T3 — Validations + create/get/getOne

- [ ] **Step 1: `lib/validations/reading-list.ts`**

```ts
import { z } from 'zod'

export const createListSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).default('PUBLIC'),
  discoverable: z.boolean().optional().default(true),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(20)).max(5).default([]),
}).transform((d) => ({ ...d, discoverable: d.visibility === 'PUBLIC' ? d.discoverable : false }))

export const updateListSchema = z.object({
  listId: z.string().min(1),
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).optional(),
  discoverable: z.boolean().optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(20)).max(5).optional(),
})

export const addBookSchema = z.object({
  listId: z.string().min(1),
  bookId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(200),
  coverUrl: z.string().url().max(500).optional(),
  isRead: z.boolean().optional().default(false),
  rating: z.number().int().min(1).max(5).optional(),
  commentary: z.string().trim().max(500).optional(),
})

export const updateListBookSchema = z.object({
  bookRowId: z.string().min(1),
  isRead: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  commentary: z.string().trim().max(500).nullable().optional(),
  order: z.number().int().min(0).optional(),
})

export const listIdSchema = z.object({ listId: z.string().min(1) })
export const bookRowIdSchema = z.object({ bookRowId: z.string().min(1) })
export const reorderBooksSchema = z.object({ listId: z.string().min(1), orderedIds: z.array(z.string().min(1)).min(1).max(500) })
export const searchBooksSchema = z.object({ query: z.string().trim().min(1).max(100), limit: z.number().int().min(1).max(50).optional() })
```

- [ ] **Step 2: `createListAction`** — uses `requireAuth` + Zod + tx + activity hook:

```ts
'use server'

import { createId } from '@paralleldrive/cuid2'
import { and, asc, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { readingLists, readingListBooks, readingListFollows, books, userProfiles, userBlocks, socialActivity } from '@/db/schema/social'
import { requireAuth, getOptionalUserId } from '@/lib/require-auth'
import { isBlocked } from '@/lib/social/is-blocked'
import { canViewList, canEditList, canFollowList } from '@/lib/reading-lists/predicates'
import { recordSocialActivityTx } from '@/lib/social/record-activity'
import { canReadBook } from '@/lib/books/can-read'
import {
  createListSchema, updateListSchema, addBookSchema, updateListBookSchema,
  listIdSchema, bookRowIdSchema, reorderBooksSchema, searchBooksSchema,
} from '@/lib/validations/reading-list'
import type { ActionResult } from './book.actions'

export async function createListAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = createListSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const id = createId()
  await db.transaction(async (tx) => {
    await tx.insert(readingLists).values({
      id, userId,
      kind: 'CUSTOM',
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      visibility: parsed.data.visibility,
      discoverable: parsed.data.discoverable,
      tags: parsed.data.tags,
    })
    if (parsed.data.visibility === 'PUBLIC') {
      await recordSocialActivityTx(tx, {
        actorId: userId,
        type: 'reading_list_created',
        subjectType: 'reading_list',
        subjectId: id,
        payload: { title: parsed.data.title },
      })
    }
  })
  return { success: true, data: { id } }
}
```

- [ ] **Step 3: `getListsAction({ filter, cursor?, limit? })`** — with Liked-at-top sentinel sort and viewer-isFollowing flag:

```ts
export async function getListsAction(input: { filter: 'mine' | 'following' | 'discover'; cursor?: string; limit?: number }): Promise<ActionResult<{ rows: ListSummary[]; nextCursor: string | null }>> {
  const viewerId = await getOptionalUserId()
  const limit = Math.min(input.limit ?? 20, 50)

  // ... three branches (mine / following / discover) — see plan continuation
}
```

(The action body is ~80 LOC. Full implementation lives in the spec §3.3 + the implementer fills in following the exact spec wording. Three filter branches; cursor decode mirrors C1 T7 base64url `{createdAt, id}` tuple; 'mine' uses `ORDER BY (kind = 'LIKED') DESC, createdAt DESC, id DESC` so Liked floats; 'discover' applies `kind='CUSTOM'` + post-filter via `isBlocked` on owners; isFollowing flag via LEFT JOIN on `reading_list_follows`.)

- [ ] **Step 4: `getListAction(listId)`** — visibility gate + book hydration:

For `kind='LIKED'`, books come from `getLikedListBooks(userId, listId)`. For `kind='CUSTOM'`, books from `db.query.readingListBooks.findMany` JOIN `books` for any rows with `bookId IS NOT NULL` to enrich with current Beehive cover/title (use the JOIN value for display when present so list reflects current book state; fall back to stored `title`/`author` text).

Block masquerade — `NOT_FOUND` on either-direction block or visibility-denied.

### T4 — `updateListAction` + `deleteListAction`

- [ ] **`updateListAction`** — canEditList gate + 3-layer discoverable defense + Liked-list coercion:

```ts
export async function updateListAction(input: unknown): Promise<ActionResult<{ updated: boolean }>> {
  const userId = await requireAuth()
  const parsed = updateListSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const list = await db.query.readingLists.findFirst({
    where: eq(readingLists.id, parsed.data.listId),
    columns: { userId: true, visibility: true, kind: true },
  })
  if (!list) return { success: false, error: 'NOT_FOUND' }
  if (!canEditList(userId, list)) return { success: false, error: 'NOT_ALLOWED' }

  const updates: Partial<typeof readingLists.$inferInsert> = {}
  if (parsed.data.title !== undefined) updates.title = parsed.data.title
  if (parsed.data.description !== undefined) updates.description = parsed.data.description
  if (parsed.data.visibility !== undefined) updates.visibility = parsed.data.visibility
  if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags

  // 3-layer discoverable defense + Liked coercion
  const effectiveVisibility = parsed.data.visibility ?? list.visibility
  if (parsed.data.discoverable !== undefined) {
    if (list.kind === 'LIKED') {
      updates.discoverable = false  // Liked never discoverable regardless of input
    } else {
      updates.discoverable = effectiveVisibility === 'PUBLIC' ? parsed.data.discoverable : false
    }
  } else if (parsed.data.visibility !== undefined && effectiveVisibility !== 'PUBLIC') {
    // Visibility flipped away from PUBLIC; force discoverable=false
    updates.discoverable = false
  }
  updates.updatedAt = new Date()

  await db.update(readingLists).set(updates).where(eq(readingLists.id, parsed.data.listId))
  return { success: true, data: { updated: true } }
}
```

- [ ] **`deleteListAction`** — Liked-undeletable guard:

```ts
export async function deleteListAction(input: unknown): Promise<ActionResult<{ deleted: boolean }>> {
  const userId = await requireAuth()
  const parsed = listIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const list = await db.query.readingLists.findFirst({
    where: eq(readingLists.id, parsed.data.listId),
    columns: { userId: true, kind: true, visibility: true },
  })
  if (!list) return { success: false, error: 'NOT_FOUND' }
  if (!canEditList(userId, list)) return { success: false, error: 'NOT_ALLOWED' }
  if (list.kind === 'LIKED') return { success: false, error: 'LIKED_LIST_UNDELETABLE' }

  await db.delete(readingLists).where(eq(readingLists.id, parsed.data.listId))  // CASCADE drops books + follows
  return { success: true, data: { deleted: true } }
}
```

### T5 — `addBookToListAction` + `updateListBookAction` + `removeBookFromListAction` + `reorderListBooksAction`

- [ ] **`addBookToListAction`** — Liked guard + bookId validation + dedupe-with-increment activity hook:

```ts
export async function addBookToListAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = addBookSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const list = await db.query.readingLists.findFirst({
    where: eq(readingLists.id, parsed.data.listId),
    columns: { userId: true, kind: true, visibility: true, title: true },
  })
  if (!list) return { success: false, error: 'NOT_FOUND' }
  if (!canEditList(userId, list)) return { success: false, error: 'NOT_ALLOWED' }
  if (list.kind === 'LIKED') return { success: false, error: 'LIKED_LIST_IMMUTABLE' }

  // Validate bookId exists + viewer-visible
  if (parsed.data.bookId) {
    const book = await db.query.books.findFirst({
      where: eq(books.id, parsed.data.bookId),
      columns: { id: true, userId: true, visibility: true },
    })
    if (!book) return { success: false, error: 'BOOK_NOT_FOUND' }
    const access = await canReadBook({ book, viewerUserId: userId })
    if (!access.ok) return { success: false, error: 'BOOK_NOT_FOUND' }  // masquerade
  }

  const id = createId()
  await db.transaction(async (tx) => {
    // Compute next order
    const [{ maxOrder }] = await tx.select({ maxOrder: sql<number>`coalesce(max("order"), -1)::int` })
      .from(readingListBooks)
      .where(eq(readingListBooks.listId, parsed.data.listId)) as any

    await tx.insert(readingListBooks).values({
      id,
      listId: parsed.data.listId,
      bookId: parsed.data.bookId ?? null,
      title: parsed.data.title,
      author: parsed.data.author,
      coverUrl: parsed.data.coverUrl ?? null,
      isRead: parsed.data.isRead,
      rating: parsed.data.rating ?? null,
      commentary: parsed.data.commentary ?? null,
      order: (maxOrder ?? -1) + 1,
    })

    await tx.update(readingLists)
      .set({ bookCount: sql`${readingLists.bookCount} + 1`, updatedAt: new Date() })
      .where(eq(readingLists.id, parsed.data.listId))

    // Dedupe-with-increment activity hook
    if (list.visibility === 'PUBLIC') {
      const windowStart = new Date(Date.now() - 30 * 60 * 1000)
      const existing = await tx.query.socialActivity.findFirst({
        where: and(
          eq(socialActivity.actorId, userId),
          eq(socialActivity.type, 'books_added_batch'),
          eq(socialActivity.subjectId, parsed.data.listId),
          gte(socialActivity.createdAt, windowStart),
        ),
      })
      if (existing) {
        await tx.update(socialActivity)
          .set({ payload: sql`jsonb_set(${socialActivity.payload}, '{count}', ((${socialActivity.payload}->>'count')::int + 1)::text::jsonb)` })
          .where(eq(socialActivity.id, existing.id))
      } else {
        await recordSocialActivityTx(tx, {
          actorId: userId,
          type: 'books_added_batch',
          subjectType: 'reading_list',
          subjectId: parsed.data.listId,
          payload: { listTitle: list.title, count: 1 },
        })
      }
    }
  })

  return { success: true, data: { id } }
}
```

- [ ] **`updateListBookAction`** — canEditList gate by joining list:

```ts
export async function updateListBookAction(input: unknown): Promise<ActionResult<{ updated: boolean }>> {
  const userId = await requireAuth()
  const parsed = updateListBookSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const row = await db.query.readingListBooks.findFirst({
    where: eq(readingListBooks.id, parsed.data.bookRowId),
    columns: { listId: true },
  })
  if (!row) return { success: false, error: 'NOT_FOUND' }
  const list = await db.query.readingLists.findFirst({
    where: eq(readingLists.id, row.listId),
    columns: { userId: true, kind: true, visibility: true },
  })
  if (!list) return { success: false, error: 'NOT_FOUND' }
  if (!canEditList(userId, list)) return { success: false, error: 'NOT_ALLOWED' }
  if (list.kind === 'LIKED') return { success: false, error: 'LIKED_LIST_IMMUTABLE' }

  const updates: Partial<typeof readingListBooks.$inferInsert> = {}
  if (parsed.data.isRead !== undefined) updates.isRead = parsed.data.isRead
  if (parsed.data.rating !== undefined) updates.rating = parsed.data.rating
  if (parsed.data.commentary !== undefined) updates.commentary = parsed.data.commentary
  if (parsed.data.order !== undefined) updates.order = parsed.data.order

  await db.update(readingListBooks).set(updates).where(eq(readingListBooks.id, parsed.data.bookRowId))
  return { success: true, data: { updated: true } }
}
```

- [ ] **`removeBookFromListAction`** — tx delete + decrement:

```ts
export async function removeBookFromListAction(input: unknown): Promise<ActionResult<{ removed: boolean }>> {
  const userId = await requireAuth()
  const parsed = bookRowIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const row = await db.query.readingListBooks.findFirst({
    where: eq(readingListBooks.id, parsed.data.bookRowId),
    columns: { listId: true },
  })
  if (!row) return { success: false, error: 'NOT_FOUND' }
  const list = await db.query.readingLists.findFirst({
    where: eq(readingLists.id, row.listId),
    columns: { userId: true, kind: true },
  })
  if (!list) return { success: false, error: 'NOT_FOUND' }
  if (!canEditList(userId, list)) return { success: false, error: 'NOT_ALLOWED' }
  if (list.kind === 'LIKED') return { success: false, error: 'LIKED_LIST_IMMUTABLE' }

  await db.transaction(async (tx) => {
    await tx.delete(readingListBooks).where(eq(readingListBooks.id, parsed.data.bookRowId))
    await tx.update(readingLists)
      .set({ bookCount: sql`greatest(${readingLists.bookCount} - 1, 0)`, updatedAt: new Date() })
      .where(eq(readingLists.id, row.listId))
  })

  return { success: true, data: { removed: true } }
}
```

- [ ] **`reorderListBooksAction`** — bulk update orders via tx, one UPDATE per id:

```ts
export async function reorderListBooksAction(input: unknown): Promise<ActionResult<{ reordered: boolean }>> {
  const userId = await requireAuth()
  const parsed = reorderBooksSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const list = await db.query.readingLists.findFirst({
    where: eq(readingLists.id, parsed.data.listId),
    columns: { userId: true, kind: true },
  })
  if (!list) return { success: false, error: 'NOT_FOUND' }
  if (!canEditList(userId, list)) return { success: false, error: 'NOT_ALLOWED' }
  if (list.kind === 'LIKED') return { success: false, error: 'LIKED_LIST_IMMUTABLE' }

  await db.transaction(async (tx) => {
    for (let i = 0; i < parsed.data.orderedIds.length; i++) {
      await tx.update(readingListBooks)
        .set({ order: i })
        .where(and(eq(readingListBooks.id, parsed.data.orderedIds[i]), eq(readingListBooks.listId, parsed.data.listId)))
    }
  })

  return { success: true, data: { reordered: true } }
}
```

### T6 — `followListAction` + `unfollowListAction` + `getListFollowersCountAction` + `getDiscoverableListsAction`

- [ ] **`followListAction`**:

```ts
export async function followListAction(input: unknown): Promise<ActionResult<{ followed: boolean }>> {
  const userId = await requireAuth()
  const parsed = listIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  const list = await db.query.readingLists.findFirst({
    where: eq(readingLists.id, parsed.data.listId),
    columns: { userId: true, visibility: true },
  })
  if (!list) return { success: false, error: 'NOT_FOUND' }
  if (!(await canFollowList(userId, list))) return { success: false, error: 'NOT_ALLOWED' }

  let inserted = false
  await db.transaction(async (tx) => {
    const result = await tx.insert(readingListFollows)
      .values({ userId, listId: parsed.data.listId })
      .onConflictDoNothing()
      .returning({ userId: readingListFollows.userId })
    if (result.length > 0) {
      inserted = true
      await tx.update(readingLists)
        .set({ followerCount: sql`${readingLists.followerCount} + 1` })
        .where(eq(readingLists.id, parsed.data.listId))
    }
  })

  return { success: true, data: { followed: inserted } }
}
```

- [ ] **`unfollowListAction`**:

```ts
export async function unfollowListAction(input: unknown): Promise<ActionResult<{ removed: boolean }>> {
  const userId = await requireAuth()
  const parsed = listIdSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  let removed = false
  await db.transaction(async (tx) => {
    const result = await tx.delete(readingListFollows)
      .where(and(eq(readingListFollows.userId, userId), eq(readingListFollows.listId, parsed.data.listId)))
      .returning({ userId: readingListFollows.userId })
    if (result.length > 0) {
      removed = true
      await tx.update(readingLists)
        .set({ followerCount: sql`greatest(${readingLists.followerCount} - 1, 0)` })
        .where(eq(readingLists.id, parsed.data.listId))
    }
  })

  return { success: true, data: { removed } }
}
```

- [ ] **`getListFollowersCountAction(listId)`** — read denorm:

```ts
export async function getListFollowersCountAction(listId: string): Promise<ActionResult<number>> {
  const [row] = await db.select({ count: readingLists.followerCount })
    .from(readingLists)
    .where(eq(readingLists.id, listId))
    .limit(1)
  return { success: true, data: row?.count ?? 0 }
}
```

- [ ] **`getDiscoverableListsAction({ cursor?, limit? })`** — wrapper:

```ts
export async function getDiscoverableListsAction(input: { cursor?: string; limit?: number }): Promise<ActionResult<{ rows: ListSummary[]; nextCursor: string | null }>> {
  return getListsAction({ filter: 'discover', cursor: input.cursor, limit: input.limit })
}
```

### T7 — `searchBooksAction` (in `lib/actions/discover.actions.ts`)

- [ ] **Add to existing `discover.actions.ts`**:

```ts
export async function searchBooksAction(input: unknown): Promise<ActionResult<{ rows: { bookId: string; title: string; author: string; coverUrl: string | null }[] }>> {
  const viewerId = await getOptionalUserId()
  const parsed = searchBooksSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }
  const limit = parsed.data.limit ?? 10
  const q = `%${parsed.data.query}%`

  const rows = await db.select({
    bookId: books.id,
    title: books.title,
    coverUrl: books.coverUrl,
    authorUserId: books.userId,
    authorUsername: userProfiles.username,
    authorDisplayName: userProfiles.displayName,
  })
    .from(books)
    .leftJoin(userProfiles, eq(userProfiles.userId, books.userId))
    .where(and(
      eq(books.visibility, 'PUBLIC'),
      eq(books.discoverable, true),
      or(ilike(books.title, q), ilike(userProfiles.displayName, q)),
    ))
    .limit(limit * 2)  // overscan to allow block filtering

  // Block-aware filter
  const filtered = []
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
```

### T8 — Extend `toggleBookLikeAction` in `lib/actions/social.actions.ts`

- [ ] **Locate `toggleBookLikeAction`** + add `ensureLikedListAction` call after the LIKE insert path commits (NOT inside the tx — best-effort outside):

```ts
import { ensureLikedListAction } from '@/lib/reading-lists/ensure-liked-list'

// ... existing toggleBookLikeAction body ...
// After the existing transaction that inserts the bookLikes row:
await ensureLikedListAction(userId)  // outside-tx best-effort; mirrors C1 record-activity precedent
```

- [ ] **Run + commit (single commit for all of T3-T8):**

```bash
npx tsc --noEmit && npm test
git add lib/actions/reading-lists.actions.ts lib/validations/reading-list.ts lib/actions/social.actions.ts lib/actions/discover.actions.ts lib/actions/__tests__/reading-lists-actions.test.ts
git commit -m "feat(c3/actions): T3-T8 14 reading-list actions + searchBooks + toggleBookLike Liked-list hook"
```

(HEREDOC + Co-Authored-By + bullet list of the 6 sub-tasks.)

- [ ] **Surface-shape test** at `lib/actions/__tests__/reading-lists-actions.test.ts` — mirror `reading-actions.test.ts` shape. Mock `@/lib/require-auth`, `@/db`, helpers. Assert `typeof X === 'function'` for all 14 actions.

---

## Task 9: `/reading-lists` index page (replaces stub)

**Files:**
- Modify: `app/[locale]/(app)/reading-lists/page.tsx` (was Coming-Soon stub from C1 T9)
- Create: components used (`<ListCard>` per T13; ship stub here if T13 hasn't landed)

- [ ] **Step 1: Rewrite `page.tsx`** as server component:

```tsx
import { Comfortaa } from 'next/font/google'
import Link from 'next/link'
import { getListsAction } from '@/lib/actions/reading-lists.actions'
import { ListCard } from './_components/list-card'
import { CreateListButton } from './_components/create-list-button'
import { requireAuth } from '@/lib/require-auth'

export default async function ReadingListsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const viewerId = await requireAuth()

  const [mineResult, followingResult] = await Promise.all([
    getListsAction({ filter: 'mine', limit: 20 }),
    getListsAction({ filter: 'following', limit: 20 }),
  ])

  if (!mineResult.success || !followingResult.success) {
    return <main className="max-w-5xl mx-auto px-4 py-6"><p className="text-red-400">Failed to load lists.</p></main>
  }

  const mine = mineResult.data.rows
  const following = followingResult.data.rows

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6">
      <header className="flex items-baseline justify-between mb-8">
        <h1 className="text-3xl font-bold text-[var(--brand)]" style={{ fontFamily: 'var(--font-comfortaa)' }}>
          Reading lists
        </h1>
        <CreateListButton locale={locale} />
      </header>

      <section className="mb-10">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3">
          My lists
        </h2>
        {mine.length === 0 ? (
          <p className="text-[var(--canvas-dark-ink-muted)] italic">Create your first reading list.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mine.map((list) => (
              <ListCard key={list.id} list={list} locale={locale} viewerIsOwner />
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3">
          Lists I follow
        </h2>
        {following.length === 0 ? (
          <p className="text-[var(--canvas-dark-ink-muted)] italic">Lists you follow appear here.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {following.map((list) => (
              <ListCard key={list.id} list={list} locale={locale} isFollowing />
            ))}
          </div>
        )}
      </section>

      <div className="text-center">
        <Link href={`/${locale}/discover?tab=lists`} className="text-sm text-[var(--brand)] hover:underline">
          Discover more lists →
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Tsc + test + commit**

```bash
npx tsc --noEmit && npm test
git add app/[locale]/\(app\)/reading-lists/page.tsx
git commit -m "feat(c3/reading-lists-page): index page with My + Following sections"
```

---

## Task 10: `/reading-lists/[listId]` detail page

**Files:**
- Create: `app/[locale]/(app)/reading-lists/[listId]/page.tsx`

- [ ] **Step 1: Server component**:

Server-fetches `getListAction(listId)` → render header (title + visibility pill + tags + description + owner card + FollowListButton + ⋯ kebab for owner with Edit/Delete) + stats strip + books list as `<BookRow>` array. For owner, mount `<DragReorderListBooks>` wrapper around books. For owner, render "+ Add Book" CTA opening `<AddBookModal>`. NOT_FOUND → `notFound()`.

```tsx
import { notFound } from 'next/navigation'
import { getListAction } from '@/lib/actions/reading-lists.actions'
import { getOptionalUserId } from '@/lib/require-auth'
import { ListDetailHeader } from '../_components/list-detail-header'
import { BookList } from '../_components/book-list'
import { AddBookCTA } from '../_components/add-book-cta'

export default async function ListDetailPage({ params }: { params: Promise<{ locale: string; listId: string }> }) {
  const { locale, listId } = await params
  const viewerId = await getOptionalUserId()
  const result = await getListAction(listId)
  if (!result.success) notFound()
  const { list, books, owner, isFollowing } = result.data
  const isOwner = viewerId === list.userId

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6">
      <ListDetailHeader list={list} owner={owner} isFollowing={isFollowing} isOwner={isOwner} locale={locale} />
      {isOwner && list.kind === 'CUSTOM' && <AddBookCTA listId={list.id} />}
      <BookList books={books} listId={list.id} isOwner={isOwner && list.kind === 'CUSTOM'} locale={locale} />
    </main>
  )
}
```

- [ ] **Step 2: Tsc + test + commit**

```bash
npx tsc --noEmit && npm test
git add app/[locale]/\(app\)/reading-lists/\[listId\]/
git commit -m "feat(c3/reading-lists-detail): /reading-lists/[listId] detail page"
```

---

## Task 11: `<CreateListModal>` + `<EditListMetadataDialog>`

**Files:**
- Create: `app/[locale]/(app)/reading-lists/_components/{create-list-modal,edit-list-metadata-dialog,create-list-button,tag-input}.tsx`

- [ ] **`<CreateListModal>`** — shadcn Dialog. Reuses C2 `<VisibilityPicker>` from `app/[locale]/(public)/discover/_components/visibility-picker.tsx`. Fields: title input (required, max 100) + description textarea (optional, max 500) + tag input (chip-based, Enter-to-add, max 5 × 20 chars; `<TagInput>` is a small inline component) + VisibilityPicker + discoverable checkbox with `useEffect` force-clear when visibility≠PUBLIC. Submit calls `createListAction` → `router.push(\`/${locale}/reading-lists/${result.data.id}\`)` on success.

- [ ] **`<EditListMetadataDialog>`** — same form shape, pre-filled. Triggered from detail page ⋯ kebab. Submit calls `updateListAction`. For Liked list, disable the discoverable checkbox (server forces false anyway).

- [ ] **`<CreateListButton>`** — small client wrapper around the modal trigger; lives in the page header.

- [ ] **Commit:**

```bash
git add app/[locale]/\(app\)/reading-lists/_components/{create-list-modal,edit-list-metadata-dialog,create-list-button,tag-input}.tsx
git commit -m "feat(c3/ui): CreateListModal + EditListMetadataDialog + TagInput + CreateListButton"
```

---

## Task 12: `<AddBookModal>` + `<EditBookRowDialog>`

**Files:**
- Create: `app/[locale]/(app)/reading-lists/_components/{add-book-modal,edit-book-row-dialog,add-book-cta}.tsx`

- [ ] **`<AddBookModal>`** — shadcn Dialog with two tabs (`shadcn Tabs` or simple state toggle):
   - **Tab 1: Search Beehive** — debounced 300ms input → `searchBooksAction({ query })` → render top 10 hits (thumb + title + author + "Pick" button). Picking populates internal state with `bookId + title + author + coverUrl`.
   - **Tab 2: Add external** — manual title + author + coverUrl fields. State holds `bookId: null`.

   Below tabs, shared metadata block: 5-star rating picker (click 1-5 stars, click already-selected to clear) + commentary textarea (max 500) + isRead checkbox.

   Submit calls `addBookToListAction` with full payload. On success, `router.refresh()` + toast + reset form.

- [ ] **`<EditBookRowDialog>`** — small Dialog for editing one row's isRead/rating/commentary. Triggered from `<BookRow>`'s ⋯ kebab. Submit calls `updateListBookAction`.

- [ ] **`<AddBookCTA>`** — client wrapper rendering "+ Add Book" button that opens `<AddBookModal>`. Mounted in the detail page when owner + kind='CUSTOM'.

- [ ] **Commit:**

```bash
git add app/[locale]/\(app\)/reading-lists/_components/{add-book-modal,edit-book-row-dialog,add-book-cta}.tsx
git commit -m "feat(c3/ui): AddBookModal (Beehive search + external add tabs) + EditBookRowDialog + AddBookCTA"
```

---

## Task 13: `<ListCard>` + `<BookRow>` + `<BookList>` + `<FollowListButton>` + `<ListDetailHeader>`

**Files:**
- Create: `app/[locale]/(app)/reading-lists/_components/{list-card,book-row,book-list,follow-list-button,list-detail-header}.tsx`

- [ ] **`<ListCard>`** — props: `list + isFollowing?: boolean + viewerIsOwner?: boolean + locale: string`. Layout: title (Comfortaa bold) + owner avatar/handle + 2-line description excerpt + tag chips (first 3 + "+N more" pill if >3) + meta row (`N books · M followers`). Visibility pill (reuse C2 `<VisibilityPill>`) when not PUBLIC. Liked variant: render `🤍 Auto` mono pill (detect via `list.kind === 'LIKED'`). Click target = `/${locale}/reading-lists/${list.id}`.

- [ ] **`<BookRow>`** — props: `book + isOwner + locale`. Layout: thumb (96px wide, 2:3 ratio, cover_url OR placeholder gradient) + title/author column + isRead checkbox (owner-editable, calls `updateListBookAction({ isRead })`) + rating display (5-star icons, owner can click to edit via `<EditBookRowDialog>`) + commentary excerpt (line-clamp-2) with "Show more" toggle expanding to full. Click target: when `bookId` set → `/${locale}/books/${bookId}`; else inert. ⋯ kebab for owner (Edit Metadata → opens `<EditBookRowDialog>`; Remove → ConfirmDialog → `removeBookFromListAction`).

- [ ] **`<BookList>`** — client component wrapping the books array. When `isOwner === true`, mount dnd-kit `<DndContext>` + `<SortableContext>` (mirror existing binder reorder pattern). On drop, calls `reorderListBooksAction({ listId, orderedIds })`. When non-owner, renders books as a plain `<ul>` (no drag).

- [ ] **`<FollowListButton>`** — client component. Props: `listId + initialFollowing`. Click → optimistic flip + `followListAction` / `unfollowListAction` + rollback on error + sonner toast. Renders "+ Follow" or "✓ Following" with brand-yellow active state.

- [ ] **`<ListDetailHeader>`** — composes title + visibility pill + tags + description + owner card + `<FollowListButton>` + (for owner) ⋯ kebab with Edit Metadata + Delete (ConfirmDialog → `deleteListAction`).

- [ ] **Commit:**

```bash
git add app/[locale]/\(app\)/reading-lists/_components/
git commit -m "feat(c3/ui): ListCard + BookRow + BookList + FollowListButton + ListDetailHeader"
```

---

## Task 14: `/discover?tab=lists` integration

**Files:**
- Modify: `app/[locale]/(public)/discover/page.tsx`

- [ ] **Step 1: Add Lists tab to existing tab strip**

Locate the existing tab strip (Books / Sparks / Hives). Add a 4th tab "Lists" → `?tab=lists`. Update the `tab` param parser to accept `'lists'`. When active, call `getDiscoverableListsAction({ limit: 24 })` and render `<ListCard>` grid below the strip.

```tsx
const tab = (searchParams.tab as string) ?? 'books'

// ... existing tab strip ...
<Link href={`/${locale}/discover?tab=lists`} className={tab === 'lists' ? activeTabClasses : tabClasses}>
  Lists
</Link>

// Below the strip, conditional render:
{tab === 'lists' && (
  <ListsTabContent locale={locale} />
)}
```

`<ListsTabContent>` is a small server component fetching `getDiscoverableListsAction` and rendering the grid + cursor pagination ("Load more" button — client component with `useTransition`).

- [ ] **Commit:**

```bash
npx tsc --noEmit && npm test
git add app/[locale]/\(public\)/discover/page.tsx
git commit -m "feat(c3/discover): /discover?tab=lists 4th tab + ListsTabContent"
```

---

## Task 15: `<ActivityEventRow>` + feed subject hydration + profile page Lists section

**Files:**
- Modify: `app/[locale]/(app)/community/_components/activity-event-row.tsx`
- Modify: `lib/actions/community.actions.ts` (subject hydration)
- Modify: `app/[locale]/(public)/u/[username]/page.tsx` (Lists section)

- [ ] **Step 1: Verb-map entries in `<ActivityEventRow>`**

```ts
// In the verb-rendering switch:
case 'reading_list_created':
  return <>created a list <strong>{row.subject.title ?? 'Untitled'}</strong></>

case 'books_added_batch': {
  const count = (row.payload as { count?: number })?.count ?? 1
  const listTitle = (row.payload as { listTitle?: string })?.listTitle ?? row.subject.title ?? 'a list'
  return <>added {count} {count === 1 ? 'book' : 'books'} to <strong>{listTitle}</strong></>
}
```

- [ ] **Step 2: Feed subject hydration in `getCommunityFeedAction`**

Locate the `subjectType` hydration block. Add a branch for `'reading_list'`:

```ts
const readingListIds = rows.filter((r) => r.subjectType === 'reading_list').map((r) => r.subjectId)
let readingListsMap = new Map<string, { id: string; title: string }>()
if (readingListIds.length > 0) {
  const listRows = await db.select({ id: readingLists.id, title: readingLists.title })
    .from(readingLists)
    .where(inArray(readingLists.id, readingListIds))
  readingListsMap = new Map(listRows.map((l) => [l.id, l]))
}

// In row composition:
if (event.subjectType === 'reading_list') {
  const list = readingListsMap.get(event.subjectId)
  subject = { id: event.subjectId, type: 'reading_list', title: list?.title ?? null }
}
```

- [ ] **Step 3: Profile page Lists section**

Add a `getUserPublicListsAction(userId, viewerId, limit)` action (could live in `reading-lists.actions.ts` or `user-profile.actions.ts`). Filters: `userId = target`, `kind='CUSTOM'` (exclude Liked), apply per-row `canViewList` for the viewer. Returns up to `limit` rows.

In `/u/[username]/page.tsx`, parallel-fetch alongside existing data. Render new section between existing sections:

```tsx
{publicLists.length > 0 && (
  <section className="mt-8">
    <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3">
      Lists
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {publicLists.map((list) => <ListCard key={list.id} list={list} locale={locale} />)}
    </div>
  </section>
)}
```

- [ ] **Commit:**

```bash
npx tsc --noEmit && npm test
git add app/[locale]/\(app\)/community/_components/activity-event-row.tsx lib/actions/community.actions.ts lib/actions/reading-lists.actions.ts app/[locale]/\(public\)/u/\[username\]/page.tsx
git commit -m "feat(c3/integrations): activity-event verb map + feed subject hydration + profile Lists section"
```

---

## Task 16: Smoke + AGENTS.md + ship

- [ ] **Step 1: Full test suite + tsc**

```bash
npm test && npx tsc --noEmit
```
Expected: 502+ green + clean.

- [ ] **Step 2: Run 22-scenario smoke** from spec §9.

- [ ] **Step 3: Update AGENTS.md Resume Here** with ship summary mirroring C1/C2 pattern:
- Wave SHA list (each task)
- Patterns now load-bearing (Liked-list-as-virtual-rows; dedupe-with-increment activity pattern; canViewList composable predicate; reusing C2 VisibilityPicker; partial unique index for "one row per user with kind=X" enforcement)
- Known follow-ups
- Carry-forward smoke targets

Set "Next concrete step" to: Chris picks C4 Book Clubs (recommended since it leverages C3's `reading_list_books` row shape) or C5 polish.

- [ ] **Step 4: Final commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): record C3 Reading Lists ship"
```

- [ ] **Step 5: Hand off to Chris**

"C3 Reading Lists is code-complete and ready for smoke. Walk the 22-scenario checklist; file `fix(c3): ...` commits for any bugs. After smoke passes, decide C4 Book Clubs (leverages C3 row shape) or C5 polish."

---

## Self-Review

**Spec coverage:**
- §2.1 schema → T1 ✓
- §2.2 enum → T1 ✓
- §2.3 enum extensions → T1 ✓
- §2.4 migration → T1 ✓
- §2.5 Liked semantics → T2 (helpers) + T4 (update coercion) + T5 (immutability guards) ✓
- §3.1 helpers → T2 ✓
- §3.2 validations → T3 ✓
- §3.3 actions → T3-T7 ✓
- §3.4 toggleBookLike extension → T8 ✓
- §3.5 dedupe-with-increment hook → T5 ✓
- §4.1 routes → T9 + T10 ✓
- §4.2 components → T11 + T12 + T13 ✓
- §4.3 discover integration → T14 ✓
- §4.4 community section rail → already wired in C1 T9 stub replacement (covered by T9 implicitly)
- §4.5 profile Lists section → T15 ✓
- §4.6 activity feed verb map + hydration → T15 ✓
- §4.7 searchBooksAction → T7 ✓
- §5 privacy gates → distributed across T3-T7 + T9 + T10 ✓
- §6 test posture → T2 + T3-T8 surface-shape tests ✓

**Placeholder scan:** No "TBD" / "implement later". `getListsAction` body in T3 is partially scaffolded with reference to spec — implementer fills following spec §3.3 wording. Acceptable since spec has full algorithm prose.

**Type consistency:** `ReadingListKind` from schema → predicates → `canEditList`/etc. `ListSummary` (action return) → `<ListCard>` props. `BookRow` (action return / derived `DerivedBookRow`) → `<BookRow>` props. Names match.

No drift detected. Plan locked.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-04-c3-reading-lists.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh implementer per task + per-task review + per-task commits. Matches C1+C2 cadence.

2. **Inline Execution** — execute in current session via executing-plans, batched with checkpoints.

For C3: subagent-driven is recommended. Wave shape from spec §7:
- W1 = T1 alone (schema)
- W2 = T2 alone (helpers)
- W3 = T3-T8 combined-single (server actions — same-file race avoidance per C2 Wave 3 precedent)
- W4 = T9 + T10 parallel (different page files)
- W5 = T11 + T12 + T13 + T14 + T15 parallel (UI — isolated component scopes)
- W6 = T16 smoke + ship

Chris picks execution mode when ready.
