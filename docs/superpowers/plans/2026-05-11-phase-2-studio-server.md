# Phase 2 — Studio Core: Server Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all server-side logic for the Studio writing workspace — book CRUD, binder tree management, chapter save/autosave, version snapshots, and publishing metadata — with full premium gating and a test harness for pure utilities.

**Architecture:** All logic lives in server actions (`lib/actions/`) following the pattern established in Phase 1 (`onboarding.actions.ts`). Pure utility functions (`lib/premium.ts`, `lib/tiptap-utils.ts`) are separated from DB-dependent code so they can be unit-tested with Vitest. Server actions validate input with Zod, check ownership on every mutation, and apply premium gates via the shared `getUserPremiumStatus` helper. No UI is built in this phase — all actions return typed result objects consumed by future page components.

**Tech Stack:** Next.js 16 server actions, Drizzle ORM, Neon Postgres, Zod v4, Vitest, `@paralleldrive/cuid2`

---

## File Map

```
lib/
├── premium.ts                        # getUserPremiumStatus(), FREE_BOOK_LIMIT, requirePremium()
├── tiptap-utils.ts                   # extractWordCount(json) — pure function
├── validations/
│   └── book.ts                       # Zod: createBookSchema, updateBookSchema
└── actions/
    ├── book.actions.ts               # createBook, getUserBooks, getBook, updateBook, deleteBook, publishBook
    ├── binder.actions.ts             # getBinderTree, createBinderItem, updateBinderItem, deleteBinderItem, reorderBinderItems
    ├── chapter.actions.ts            # getChapter, saveChapter, updateChapterStatus, updateChapterNotes
    ├── snapshot.actions.ts           # getChapterSnapshots, restoreSnapshot (premium)
    └── publishing.actions.ts         # getPublishingMetadata, updatePublishingMetadata, getExportPresets
__tests__/
├── tiptap-utils.test.ts              # extractWordCount unit tests
├── premium.test.ts                   # getBookLimitForTier unit tests
└── validations/
    └── book.test.ts                  # Zod schema validation tests
vitest.config.ts                      # Vitest config for Next.js + path aliases
```

---

## Task 1: Vitest Test Infrastructure

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add test scripts)
- Create: `__tests__/smoke.test.ts`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest vite-tsconfig-paths
```

Expected: packages added to `devDependencies`.

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Add test scripts to `package.json`**

Read `package.json` and add under `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write `__tests__/smoke.test.ts`**

```ts
describe('smoke', () => {
  it('passes', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test
```

Expected output:
```
✓ __tests__/smoke.test.ts (1)
  ✓ smoke > passes
Test Files  1 passed (1)
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add Vitest test infrastructure"
```

---

## Task 2: Premium Gate Utility

**Files:**
- Create: `lib/premium.ts`
- Create: `__tests__/premium.test.ts`

- [ ] **Step 1: Write `__tests__/premium.test.ts` (failing)**

```ts
import { FREE_BOOK_LIMIT, getBookLimitForTier } from '@/lib/premium'

describe('getBookLimitForTier', () => {
  it('returns FREE_BOOK_LIMIT for free users', () => {
    expect(getBookLimitForTier(false)).toBe(FREE_BOOK_LIMIT)
  })

  it('returns Infinity for premium users', () => {
    expect(getBookLimitForTier(true)).toBe(Infinity)
  })
})

describe('FREE_BOOK_LIMIT', () => {
  it('is 3', () => {
    expect(FREE_BOOK_LIMIT).toBe(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose
```

Expected: FAIL with "Cannot find module '@/lib/premium'"

- [ ] **Step 3: Write `lib/premium.ts`**

```ts
import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const FREE_BOOK_LIMIT = 3
export const FREE_HIVE_LIMIT = 3
export const FREE_HIVE_MEMBER_LIMIT = 5

/** Returns the max number of active books for the given tier. */
export function getBookLimitForTier(isPremium: boolean): number {
  return isPremium ? Infinity : FREE_BOOK_LIMIT
}

/** Returns the max number of active hives for the given tier. */
export function getHiveLimitForTier(isPremium: boolean): number {
  return isPremium ? Infinity : FREE_HIVE_LIMIT
}

/**
 * Queries whether the given user has an active premium subscription.
 * Returns false if the userBilling row doesn't exist yet (new users).
 */
export async function getUserPremiumStatus(userId: string): Promise<boolean> {
  const billing = await db.query.userBilling.findFirst({
    where: eq(userBilling.userId, userId),
    columns: { premium: true },
  })
  return billing?.premium ?? false
}

/**
 * Throws a descriptive error if the user is not premium.
 * Use in server actions before premium-gated operations.
 */
export function requirePremium(isPremium: boolean, featureName: string): void {
  if (!isPremium) {
    throw new Error(`PREMIUM_REQUIRED:${featureName}`)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose
```

Expected:
```
✓ __tests__/premium.test.ts (3)
  ✓ getBookLimitForTier > returns FREE_BOOK_LIMIT for free users
  ✓ getBookLimitForTier > returns Infinity for premium users
  ✓ FREE_BOOK_LIMIT > is 3
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: premium gate utility — FREE_BOOK_LIMIT, getUserPremiumStatus, requirePremium"
```

---

## Task 3: TipTap Word Count Utility

**Files:**
- Create: `lib/tiptap-utils.ts`
- Create: `__tests__/tiptap-utils.test.ts`

- [ ] **Step 1: Write `__tests__/tiptap-utils.test.ts` (failing)**

```ts
import { extractWordCount } from '@/lib/tiptap-utils'

describe('extractWordCount', () => {
  it('returns 0 for empty doc', () => {
    expect(extractWordCount({ type: 'doc', content: [] })).toBe(0)
  })

  it('returns 0 for null/undefined', () => {
    expect(extractWordCount(null)).toBe(0)
    expect(extractWordCount(undefined)).toBe(0)
  })

  it('counts words in a single paragraph', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    }
    expect(extractWordCount(doc)).toBe(2)
  })

  it('counts words across multiple paragraphs', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First paragraph here.' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second paragraph here.' }],
        },
      ],
    }
    expect(extractWordCount(doc)).toBe(6)
  })

  it('handles nested content (headings, bold, etc.)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Chapter One' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Some ' },
            {
              type: 'text',
              marks: [{ type: 'bold' }],
              text: 'bold words',
            },
            { type: 'text', text: ' here.' },
          ],
        },
      ],
    }
    expect(extractWordCount(doc)).toBe(6)
  })

  it('ignores whitespace-only text nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '   ' }],
        },
      ],
    }
    expect(extractWordCount(doc)).toBe(0)
  })

  it('handles scene break horizontal rule nodes (no text)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Before break.' }],
        },
        { type: 'horizontalRule' },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'After break.' }],
        },
      ],
    }
    expect(extractWordCount(doc)).toBe(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose
```

Expected: FAIL with "Cannot find module '@/lib/tiptap-utils'"

- [ ] **Step 3: Write `lib/tiptap-utils.ts`**

```ts
type TipTapNode = {
  type?: string
  text?: string
  content?: TipTapNode[]
  marks?: unknown[]
  attrs?: Record<string, unknown>
}

/**
 * Recursively extracts word count from a TipTap JSON document.
 * Works on any TipTap node (doc, paragraph, heading, text, etc.).
 */
export function extractWordCount(json: unknown): number {
  if (json === null || json === undefined) return 0
  if (typeof json !== 'object') return 0

  const node = json as TipTapNode
  let count = 0

  if (typeof node.text === 'string') {
    const words = node.text.trim().split(/\s+/).filter(Boolean)
    count += words.length
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      count += extractWordCount(child)
    }
  }

  return count
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose
```

Expected:
```
✓ __tests__/tiptap-utils.test.ts (7)
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: TipTap word count utility with tests"
```

---

## Task 4: Book Validations

**Files:**
- Create: `lib/validations/book.ts`
- Create: `__tests__/validations/book.test.ts`

- [ ] **Step 1: Write `__tests__/validations/book.test.ts` (failing)**

```ts
import { createBookSchema, updateBookSchema } from '@/lib/validations/book'

describe('createBookSchema', () => {
  it('accepts valid input', () => {
    const result = createBookSchema.safeParse({ title: 'My Novel', genre: 'Fantasy' })
    expect(result.success).toBe(true)
  })

  it('accepts minimal input (title only)', () => {
    const result = createBookSchema.safeParse({ title: 'My Novel' })
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = createBookSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects title over 200 characters', () => {
    const result = createBookSchema.safeParse({ title: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })
})

describe('updateBookSchema', () => {
  it('accepts partial updates', () => {
    const result = updateBookSchema.safeParse({ synopsis: 'A story about bees.' })
    expect(result.success).toBe(true)
  })

  it('rejects visibility outside allowed values', () => {
    const result = updateBookSchema.safeParse({ visibility: 'FRIENDS' })
    expect(result.success).toBe(false)
  })

  it('accepts valid visibility', () => {
    const result = updateBookSchema.safeParse({ visibility: 'PUBLIC' })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose
```

Expected: FAIL with "Cannot find module '@/lib/validations/book'"

- [ ] **Step 3: Write `lib/validations/book.ts`**

```ts
import { z } from 'zod'

export const createBookSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  genre: z.string().max(50).optional(),
  templateId: z.string().optional(),
})

export const updateBookSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  genre: z.string().max(50).optional().nullable(),
  synopsis: z.string().max(2000).optional().nullable(),
  visibility: z.enum(['PRIVATE', 'PUBLIC']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  coverUrl: z.string().url().optional().nullable(),
})

export const createBinderItemSchema = z.object({
  bookId: z.string().min(1),
  parentId: z.string().optional().nullable(),
  type: z.enum([
    'part', 'chapter', 'front_matter', 'back_matter',
    'research_folder', 'research_note', 'character', 'outline',
  ]),
  title: z.string().min(1).max(200),
  order: z.number().int().min(0).default(0),
})

export const updateBinderItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.unknown().optional().nullable(),
})

export const reorderBinderItemsSchema = z.array(z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  parentId: z.string().nullable(),
}))

export const updateChapterNotesSchema = z.object({
  notes: z.string().max(10000).nullable(),
})

export const updatePublishingMetadataSchema = z.object({
  isbn: z.string().max(20).optional().nullable(),
  subtitle: z.string().max(200).optional().nullable(),
  trimSize: z.string().max(20).optional(),
  authorBio: z.string().max(1000).optional().nullable(),
  dedication: z.string().max(500).optional().nullable(),
  publisherName: z.string().max(200).optional().nullable(),
  edition: z.string().max(100).optional(),
})
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --reporter=verbose
```

Expected:
```
✓ __tests__/validations/book.test.ts (6)
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all test files pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: book, binder, chapter, and publishing validation schemas with tests"
```

---

## Task 5: Book CRUD Server Actions

**Files:**
- Create: `lib/actions/book.actions.ts`

- [ ] **Step 1: Write `lib/actions/book.actions.ts`**

```ts
'use server'

import { db } from '@/db'
import {
  books, bookPublishingMetadata, binderItems, chapters, bookTemplates,
} from '@/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { getUserPremiumStatus, FREE_BOOK_LIMIT } from '@/lib/premium'
import { createBookSchema, updateBookSchema } from '@/lib/validations/book'
import { createId } from '@paralleldrive/cuid2'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BookSummary = {
  id: string
  title: string
  genre: string | null
  visibility: 'PRIVATE' | 'PUBLIC'
  status: 'DRAFT' | 'PUBLISHED'
  coverUrl: string | null
  synopsis: string | null
  wordCount: number
  chapterCount: number
  createdAt: Date
  updatedAt: Date
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verifies the book belongs to the authenticated user. */
async function assertBookOwner(bookId: string, userId: string): Promise<void> {
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, userId)),
    columns: { id: true },
  })
  if (!book) throw new Error('Book not found or access denied')
}

/** Returns the count of active books for a user. */
async function getActiveBookCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(books)
    .where(eq(books.userId, userId))
  return Number(result[0]?.count ?? 0)
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Creates a new book. If templateId is provided, seeds the binder with the
 * template structure. Free users are limited to FREE_BOOK_LIMIT active books.
 */
export async function createBookAction(input: {
  title: string
  genre?: string
  templateId?: string
}): Promise<ActionResult<{ bookId: string }>> {
  const userId = await requireAuth()

  const parsed = createBookSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const isPremium = await getUserPremiumStatus(userId)
  if (!isPremium) {
    const currentCount = await getActiveBookCount(userId)
    if (currentCount >= FREE_BOOK_LIMIT) {
      return { success: false, error: 'FREE_LIMIT_REACHED' }
    }
  }

  const bookId = createId()

  await db.insert(books).values({
    id: bookId,
    userId,
    title: parsed.data.title,
    genre: parsed.data.genre ?? null,
  })

  if (parsed.data.templateId) {
    // Apply template structure
    const template = await db.query.bookTemplates.findFirst({
      where: eq(bookTemplates.id, parsed.data.templateId),
    })

    if (template?.structure) {
      const structure = template.structure as {
        parts?: Array<{ title: string; chapterCount: number }>
        researchFolders?: string[]
      }

      let globalOrder = 0

      // Create parts and their chapters
      for (const part of structure.parts ?? []) {
        const partId = createId()
        await db.insert(binderItems).values({
          id: partId,
          bookId,
          type: 'part',
          title: part.title,
          order: globalOrder++,
        })

        for (let i = 0; i < (part.chapterCount ?? 1); i++) {
          const chapterBinderId = createId()
          const chapterId = createId()

          await db.insert(binderItems).values({
            id: chapterBinderId,
            bookId,
            parentId: partId,
            type: 'chapter',
            title: `Chapter ${i + 1}`,
            order: i,
          })

          await db.insert(chapters).values({
            id: chapterId,
            bookId,
            binderItemId: chapterBinderId,
          })
        }
      }

      // Create research folders
      for (const folderName of structure.researchFolders ?? []) {
        await db.insert(binderItems).values({
          bookId,
          type: 'research_folder',
          title: folderName,
          order: globalOrder++,
        })
      }
    }
  } else {
    // Default: one chapter
    const chapterBinderId = createId()
    const chapterId = createId()

    await db.insert(binderItems).values({
      id: chapterBinderId,
      bookId,
      type: 'chapter',
      title: 'Chapter 1',
      order: 0,
    })

    await db.insert(chapters).values({
      id: chapterId,
      bookId,
      binderItemId: chapterBinderId,
    })
  }

  return { success: true, data: { bookId } }
}

/**
 * Returns all books belonging to the authenticated user,
 * ordered by most recently updated.
 */
export async function getUserBooksAction(): Promise<
  ActionResult<BookSummary[]>
> {
  const userId = await requireAuth()

  const rows = await db.query.books.findMany({
    where: eq(books.userId, userId),
    with: {
      chapters: { columns: { wordCount: true } },
    },
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
  })

  const summaries: BookSummary[] = rows.map((book) => ({
    id: book.id,
    title: book.title,
    genre: book.genre,
    visibility: book.visibility,
    status: book.status,
    coverUrl: book.coverUrl,
    synopsis: book.synopsis,
    wordCount: book.chapters.reduce((sum, ch) => sum + ch.wordCount, 0),
    chapterCount: book.chapters.length,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
  }))

  return { success: true, data: summaries }
}

/**
 * Returns a single book by ID. The book must belong to the authenticated user.
 */
export async function getBookAction(bookId: string): Promise<
  ActionResult<{
    id: string
    title: string
    genre: string | null
    visibility: 'PRIVATE' | 'PUBLIC'
    status: 'DRAFT' | 'PUBLISHED'
    coverUrl: string | null
    synopsis: string | null
    createdAt: Date
    updatedAt: Date
  }>
> {
  const userId = await requireAuth()

  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, userId)),
    columns: {
      id: true, title: true, genre: true, visibility: true,
      status: true, coverUrl: true, synopsis: true,
      createdAt: true, updatedAt: true,
    },
  })

  if (!book) return { success: false, error: 'Book not found' }

  return { success: true, data: book }
}

/**
 * Updates mutable book fields. Only the book owner can update.
 */
export async function updateBookAction(
  bookId: string,
  input: {
    title?: string
    genre?: string | null
    synopsis?: string | null
    visibility?: 'PRIVATE' | 'PUBLIC'
    status?: 'DRAFT' | 'PUBLISHED'
    coverUrl?: string | null
  },
): Promise<ActionResult> {
  const userId = await requireAuth()

  const parsed = updateBookSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await assertBookOwner(bookId, userId)

  const updates: Partial<typeof books.$inferInsert> = {}
  if (parsed.data.title !== undefined) updates.title = parsed.data.title
  if (parsed.data.genre !== undefined) updates.genre = parsed.data.genre
  if (parsed.data.synopsis !== undefined) updates.synopsis = parsed.data.synopsis
  if (parsed.data.visibility !== undefined) updates.visibility = parsed.data.visibility
  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.coverUrl !== undefined) updates.coverUrl = parsed.data.coverUrl

  if (Object.keys(updates).length === 0) return { success: true, data: undefined }

  await db
    .update(books)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(books.id, bookId))

  return { success: true, data: undefined }
}

/**
 * Publishes a book: sets visibility to PUBLIC and status to PUBLISHED.
 */
export async function publishBookAction(bookId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  await db
    .update(books)
    .set({ visibility: 'PUBLIC', status: 'PUBLISHED', updatedAt: new Date() })
    .where(eq(books.id, bookId))

  return { success: true, data: undefined }
}

/**
 * Unpublishes a book: sets visibility to PRIVATE and status to DRAFT.
 */
export async function unpublishBookAction(bookId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  await db
    .update(books)
    .set({ visibility: 'PRIVATE', status: 'DRAFT', updatedAt: new Date() })
    .where(eq(books.id, bookId))

  return { success: true, data: undefined }
}

/**
 * Deletes a book and all its content. Cascade deletes handle
 * binder_items, chapters, chapter_snapshots, etc.
 */
export async function deleteBookAction(bookId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  await db.delete(books).where(and(eq(books.id, bookId), eq(books.userId, userId)))

  return { success: true, data: undefined }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: book CRUD server actions — create, list, get, update, publish, delete"
```

---

## Task 6: Binder Tree Actions

**Files:**
- Create: `lib/actions/binder.actions.ts`

- [ ] **Step 1: Write `lib/actions/binder.actions.ts`**

```ts
'use server'

import { db } from '@/db'
import { books, binderItems, chapters } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import {
  createBinderItemSchema,
  updateBinderItemSchema,
  reorderBinderItemsSchema,
} from '@/lib/validations/book'
import { createId } from '@paralleldrive/cuid2'
import type { ActionResult } from './book.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BinderItemRow = {
  id: string
  bookId: string
  parentId: string | null
  type: 'part' | 'chapter' | 'front_matter' | 'back_matter' | 'research_folder' | 'research_note' | 'character' | 'outline'
  title: string
  order: number
  content: unknown
  chapterId: string | null  // Populated for type === 'chapter'
  createdAt: Date
  updatedAt: Date
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verifies a binder item belongs to a book owned by the user. */
async function assertBinderOwner(
  binderItemId: string,
  userId: string,
): Promise<{ bookId: string }> {
  const item = await db
    .select({ bookId: binderItems.bookId, bookUserId: books.userId })
    .from(binderItems)
    .innerJoin(books, eq(binderItems.bookId, books.id))
    .where(eq(binderItems.id, binderItemId))
    .limit(1)

  if (!item[0] || item[0].bookUserId !== userId) {
    throw new Error('Binder item not found or access denied')
  }

  return { bookId: item[0].bookId }
}

/** Verifies a book belongs to the authenticated user. */
async function assertBookOwner(bookId: string, userId: string): Promise<void> {
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, userId)),
    columns: { id: true },
  })
  if (!book) throw new Error('Book not found or access denied')
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Returns all binder items for a book, ordered by `order` field.
 * Also returns the associated chapter ID for items of type 'chapter'.
 * The UI reconstructs the tree from parentId relationships.
 */
export async function getBinderTreeAction(
  bookId: string,
): Promise<ActionResult<BinderItemRow[]>> {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  const items = await db.query.binderItems.findMany({
    where: eq(binderItems.bookId, bookId),
    with: {
      children: false,
      parent: false,
    },
    orderBy: [asc(binderItems.order)],
  })

  // Fetch associated chapter IDs for chapter-type items
  const chapterItems = await db.query.chapters.findMany({
    where: eq(chapters.bookId, bookId),
    columns: { id: true, binderItemId: true },
  })
  const chapterByBinderId = new Map(
    chapterItems.map((c) => [c.binderItemId, c.id]),
  )

  const rows: BinderItemRow[] = items.map((item) => ({
    id: item.id,
    bookId: item.bookId,
    parentId: item.parentId,
    type: item.type,
    title: item.title,
    order: item.order,
    content: item.content,
    chapterId: item.type === 'chapter' ? (chapterByBinderId.get(item.id) ?? null) : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }))

  return { success: true, data: rows }
}

/**
 * Creates a new binder item. If type is 'chapter', also creates
 * the associated chapters row.
 */
export async function createBinderItemAction(input: {
  bookId: string
  parentId?: string | null
  type: BinderItemRow['type']
  title: string
  order?: number
}): Promise<ActionResult<{ id: string; chapterId: string | null }>> {
  const userId = await requireAuth()

  const parsed = createBinderItemSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await assertBookOwner(parsed.data.bookId, userId)

  const binderId = createId()

  await db.insert(binderItems).values({
    id: binderId,
    bookId: parsed.data.bookId,
    parentId: parsed.data.parentId ?? null,
    type: parsed.data.type,
    title: parsed.data.title,
    order: parsed.data.order,
  })

  let chapterId: string | null = null

  if (parsed.data.type === 'chapter') {
    chapterId = createId()
    await db.insert(chapters).values({
      id: chapterId,
      bookId: parsed.data.bookId,
      binderItemId: binderId,
    })
  }

  return { success: true, data: { id: binderId, chapterId } }
}

/**
 * Updates a binder item's title or content (for research/character nodes).
 */
export async function updateBinderItemAction(
  id: string,
  input: { title?: string; content?: unknown },
): Promise<ActionResult> {
  const userId = await requireAuth()

  const parsed = updateBinderItemSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await assertBinderOwner(id, userId)

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (parsed.data.title !== undefined) updates.title = parsed.data.title
  if (parsed.data.content !== undefined) updates.content = parsed.data.content

  await db.update(binderItems).set(updates).where(eq(binderItems.id, id))

  return { success: true, data: undefined }
}

/**
 * Deletes a binder item. If type is 'chapter', the associated chapter row
 * is cascade-deleted via the FK. Research items are deleted directly.
 */
export async function deleteBinderItemAction(id: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertBinderOwner(id, userId)

  await db.delete(binderItems).where(eq(binderItems.id, id))

  return { success: true, data: undefined }
}

/**
 * Bulk-updates order and parentId for a set of binder items.
 * Called after a drag-and-drop reorder in the UI.
 * All items must belong to the same book owned by the user.
 */
export async function reorderBinderItemsAction(
  bookId: string,
  updates: Array<{ id: string; order: number; parentId: string | null }>,
): Promise<ActionResult> {
  const userId = await requireAuth()

  const parsed = reorderBinderItemsSchema.safeParse(updates)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await assertBookOwner(bookId, userId)

  // Run all updates in parallel within the same book scope
  await Promise.all(
    parsed.data.map(({ id, order, parentId }) =>
      db
        .update(binderItems)
        .set({ order, parentId, updatedAt: new Date() })
        .where(and(eq(binderItems.id, id), eq(binderItems.bookId, bookId))),
    ),
  )

  return { success: true, data: undefined }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: binder tree server actions — CRUD, reorder"
```

---

## Task 7: Chapter Actions

**Files:**
- Create: `lib/actions/chapter.actions.ts`

- [ ] **Step 1: Write `lib/actions/chapter.actions.ts`**

```ts
'use server'

import { db } from '@/db'
import { books, chapters, chapterSnapshots } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { getUserPremiumStatus } from '@/lib/premium'
import { extractWordCount } from '@/lib/tiptap-utils'
import { updateChapterNotesSchema } from '@/lib/validations/book'
import type { ActionResult } from './book.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChapterData = {
  id: string
  bookId: string
  binderItemId: string | null
  content: unknown
  wordCount: number
  status: 'IDEA' | 'OUTLINE' | 'FIRST_DRAFT' | 'REVISED' | 'FINAL'
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verifies a chapter belongs to a book owned by the user.
 * Returns the chapter and book for further processing.
 */
async function assertChapterOwner(
  chapterId: string,
  userId: string,
): Promise<{ chapter: typeof chapters.$inferSelect; bookId: string }> {
  const chapter = await db.query.chapters.findFirst({
    where: eq(chapters.id, chapterId),
    with: {
      book: { columns: { userId: true } },
    },
  })

  if (!chapter || chapter.book.userId !== userId) {
    throw new Error('Chapter not found or access denied')
  }

  return { chapter, bookId: chapter.bookId }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Returns chapter data including content (TipTap JSON).
 * Only the book owner can read a chapter this way.
 */
export async function getChapterAction(
  chapterId: string,
): Promise<ActionResult<ChapterData>> {
  const userId = await requireAuth()
  const { chapter } = await assertChapterOwner(chapterId, userId)

  return {
    success: true,
    data: {
      id: chapter.id,
      bookId: chapter.bookId,
      binderItemId: chapter.binderItemId,
      content: chapter.content,
      wordCount: chapter.wordCount,
      status: chapter.status,
      notes: chapter.notes,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
    },
  }
}

/**
 * Saves chapter content. Extracts word count from TipTap JSON.
 * For premium users, creates a snapshot on every save.
 * Returns the updated word count.
 */
export async function saveChapterAction(
  chapterId: string,
  content: unknown,
): Promise<ActionResult<{ wordCount: number }>> {
  const userId = await requireAuth()
  const { chapter } = await assertChapterOwner(chapterId, userId)

  const wordCount = extractWordCount(content)

  await db
    .update(chapters)
    .set({ content, wordCount, updatedAt: new Date() })
    .where(eq(chapters.id, chapterId))

  // Update book's updatedAt so the dashboard shows correct last-edited time
  await db
    .update(books)
    .set({ updatedAt: new Date() })
    .where(eq(books.id, chapter.bookId))

  // Create snapshot for premium users
  const isPremium = await getUserPremiumStatus(userId)
  if (isPremium) {
    await db.insert(chapterSnapshots).values({
      chapterId,
      content,
      wordCount,
    })
  }

  return { success: true, data: { wordCount } }
}

/**
 * Updates the chapter's status (Idea → Outline → First Draft → Revised → Final).
 */
export async function updateChapterStatusAction(
  chapterId: string,
  status: ChapterData['status'],
): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertChapterOwner(chapterId, userId)

  const validStatuses: ChapterData['status'][] = [
    'IDEA', 'OUTLINE', 'FIRST_DRAFT', 'REVISED', 'FINAL',
  ]
  if (!validStatuses.includes(status)) {
    return { success: false, error: 'Invalid status' }
  }

  await db
    .update(chapters)
    .set({ status, updatedAt: new Date() })
    .where(eq(chapters.id, chapterId))

  return { success: true, data: undefined }
}

/**
 * Updates the chapter's private notes (not visible to Hive collaborators).
 */
export async function updateChapterNotesAction(
  chapterId: string,
  notes: string | null,
): Promise<ActionResult> {
  const userId = await requireAuth()

  const parsed = updateChapterNotesSchema.safeParse({ notes })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await assertChapterOwner(chapterId, userId)

  await db
    .update(chapters)
    .set({ notes: parsed.data.notes, updatedAt: new Date() })
    .where(eq(chapters.id, chapterId))

  return { success: true, data: undefined }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: chapter server actions — get, save with word count + snapshots, status, notes"
```

---

## Task 8: Snapshot Actions (Premium)

**Files:**
- Create: `lib/actions/snapshot.actions.ts`

- [ ] **Step 1: Write `lib/actions/snapshot.actions.ts`**

```ts
'use server'

import { db } from '@/db'
import { chapters, chapterSnapshots } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { getUserPremiumStatus, requirePremium } from '@/lib/premium'
import type { ActionResult } from './book.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SnapshotSummary = {
  id: string
  wordCount: number
  createdAt: Date
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verifies a chapter belongs to a book owned by the user. */
async function assertChapterOwner(chapterId: string, userId: string): Promise<void> {
  const chapter = await db.query.chapters.findFirst({
    where: eq(chapters.id, chapterId),
    with: { book: { columns: { userId: true } } },
  })

  if (!chapter || chapter.book.userId !== userId) {
    throw new Error('Chapter not found or access denied')
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Lists snapshots for a chapter, newest first.
 * Free users receive a PREMIUM_REQUIRED error.
 */
export async function getChapterSnapshotsAction(
  chapterId: string,
): Promise<ActionResult<SnapshotSummary[]>> {
  const userId = await requireAuth()

  const isPremium = await getUserPremiumStatus(userId)
  requirePremium(isPremium, 'version_history')

  await assertChapterOwner(chapterId, userId)

  const snapshots = await db
    .select({
      id: chapterSnapshots.id,
      wordCount: chapterSnapshots.wordCount,
      createdAt: chapterSnapshots.createdAt,
    })
    .from(chapterSnapshots)
    .where(eq(chapterSnapshots.chapterId, chapterId))
    .orderBy(desc(chapterSnapshots.createdAt))
    .limit(50)

  return { success: true, data: snapshots }
}

/**
 * Restores a snapshot: copies snapshot content back to the chapter.
 * Creates a new snapshot first (so the current state is preserved).
 * Premium only.
 */
export async function restoreSnapshotAction(
  snapshotId: string,
): Promise<ActionResult<{ wordCount: number }>> {
  const userId = await requireAuth()

  const isPremium = await getUserPremiumStatus(userId)
  requirePremium(isPremium, 'version_history')

  const snapshot = await db.query.chapterSnapshots.findFirst({
    where: eq(chapterSnapshots.id, snapshotId),
    with: {
      chapter: {
        with: { book: { columns: { userId: true } } },
      },
    },
  })

  if (!snapshot || snapshot.chapter.book.userId !== userId) {
    return { success: false, error: 'Snapshot not found or access denied' }
  }

  const chapterId = snapshot.chapterId

  // Save current chapter content as a snapshot before restoring
  const current = await db.query.chapters.findFirst({
    where: eq(chapters.id, chapterId),
    columns: { content: true, wordCount: true },
  })

  if (current?.content) {
    await db.insert(chapterSnapshots).values({
      chapterId,
      content: current.content,
      wordCount: current.wordCount,
    })
  }

  // Restore the selected snapshot
  await db
    .update(chapters)
    .set({
      content: snapshot.content,
      wordCount: snapshot.wordCount,
      updatedAt: new Date(),
    })
    .where(eq(chapters.id, chapterId))

  return { success: true, data: { wordCount: snapshot.wordCount } }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: chapter snapshot actions — list history, restore (premium-gated)"
```

---

## Task 9: Publishing Metadata Actions

**Files:**
- Create: `lib/actions/publishing.actions.ts`

- [ ] **Step 1: Write `lib/actions/publishing.actions.ts`**

```ts
'use server'

import { db } from '@/db'
import { books, bookPublishingMetadata, exportPresets } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { getUserPremiumStatus, requirePremium } from '@/lib/premium'
import { updatePublishingMetadataSchema } from '@/lib/validations/book'
import type { ActionResult } from './book.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PublishingMetadata = {
  bookId: string
  isbn: string | null
  subtitle: string | null
  trimSize: string | null
  authorBio: string | null
  dedication: string | null
  publisherName: string | null
  edition: string | null
}

export type ExportPreset = {
  id: string
  name: string
  format: 'EPUB' | 'PDF' | 'DOCX' | 'TXT' | 'ZIP'
  config: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verifies the book belongs to the authenticated user. */
async function assertBookOwner(bookId: string, userId: string): Promise<void> {
  const book = await db.query.books.findFirst({
    where: and(eq(books.id, bookId), eq(books.userId, userId)),
    columns: { id: true },
  })
  if (!book) throw new Error('Book not found or access denied')
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Returns publishing metadata for a book.
 * Returns defaults if no metadata row exists yet.
 */
export async function getPublishingMetadataAction(
  bookId: string,
): Promise<ActionResult<PublishingMetadata>> {
  const userId = await requireAuth()
  await assertBookOwner(bookId, userId)

  const meta = await db.query.bookPublishingMetadata.findFirst({
    where: eq(bookPublishingMetadata.bookId, bookId),
  })

  if (!meta) {
    // Return defaults — row is created on first update
    return {
      success: true,
      data: {
        bookId,
        isbn: null,
        subtitle: null,
        trimSize: '6x9',
        authorBio: null,
        dedication: null,
        publisherName: null,
        edition: 'First Edition',
      },
    }
  }

  return {
    success: true,
    data: {
      bookId: meta.bookId,
      isbn: meta.isbn,
      subtitle: meta.subtitle,
      trimSize: meta.trimSize,
      authorBio: meta.authorBio,
      dedication: meta.dedication,
      publisherName: meta.publisherName,
      edition: meta.edition,
    },
  }
}

/**
 * Updates publishing metadata. Premium-gated.
 * Creates the metadata row if it doesn't exist.
 */
export async function updatePublishingMetadataAction(
  bookId: string,
  input: {
    isbn?: string | null
    subtitle?: string | null
    trimSize?: string
    authorBio?: string | null
    dedication?: string | null
    publisherName?: string | null
    edition?: string
  },
): Promise<ActionResult> {
  const userId = await requireAuth()

  const isPremium = await getUserPremiumStatus(userId)
  requirePremium(isPremium, 'publishing_metadata')

  const parsed = updatePublishingMetadataSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await assertBookOwner(bookId, userId)

  await db
    .insert(bookPublishingMetadata)
    .values({
      bookId,
      isbn: parsed.data.isbn ?? null,
      subtitle: parsed.data.subtitle ?? null,
      trimSize: parsed.data.trimSize ?? '6x9',
      authorBio: parsed.data.authorBio ?? null,
      dedication: parsed.data.dedication ?? null,
      publisherName: parsed.data.publisherName ?? null,
      edition: parsed.data.edition ?? 'First Edition',
    })
    .onConflictDoUpdate({
      target: bookPublishingMetadata.bookId,
      set: {
        isbn: parsed.data.isbn,
        subtitle: parsed.data.subtitle,
        trimSize: parsed.data.trimSize,
        authorBio: parsed.data.authorBio,
        dedication: parsed.data.dedication,
        publisherName: parsed.data.publisherName,
        edition: parsed.data.edition,
        updatedAt: new Date(),
      },
    })

  return { success: true, data: undefined }
}

/**
 * Returns all system export presets (seeded in Phase 1).
 * Visible to all users; export itself is premium-gated in the UI.
 */
export async function getExportPresetsAction(): Promise<ActionResult<ExportPreset[]>> {
  await requireAuth()

  const presets = await db
    .select({
      id: exportPresets.id,
      name: exportPresets.name,
      format: exportPresets.format,
      config: exportPresets.config,
    })
    .from(exportPresets)
    .where(eq(exportPresets.isSystemPreset, true))
    .orderBy(exportPresets.name)

  return { success: true, data: presets }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all test files pass (smoke, premium, tiptap-utils, book validations).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: publishing metadata actions — get/update (premium), export presets list"
```

---

## Verification

After all tasks complete:

- [ ] `npm test` — all test files pass
- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] All action files follow `'use server'` pattern
- [ ] All mutations verify ownership (`assertBookOwner` / `assertChapterOwner` / `assertBinderOwner`)
- [ ] Premium gates throw `PREMIUM_REQUIRED:<feature>` error string for UI to intercept
- [ ] Free tier limit returns `'FREE_LIMIT_REACHED'` error string for upgrade prompt
- [ ] `createBookAction` creates at least one default chapter binder item + chapter row
- [ ] `saveChapterAction` extracts word count from TipTap JSON and updates `books.updatedAt`
- [ ] `restoreSnapshotAction` saves current content before restoring
