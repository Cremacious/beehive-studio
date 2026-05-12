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
