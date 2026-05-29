'use server'

import { db } from '@/db'
import { books, binderItems, chapters } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { assertBookOwner } from './_helpers'
import {
  requireBinderWritePermission,
  requireBinderCreatePermission,
} from '@/lib/hive/permissions'
import { isBookOverflow } from '@/lib/billing/book-overflow'
import {
  createBinderItemSchema,
  updateBinderItemSchema,
  reorderBinderItemsSchema,
} from '@/lib/validations/book'
import { createId } from '@paralleldrive/cuid2'
import type { ActionResult } from './book.actions'
import type { ChapterStatus } from '@/lib/books/is-chapter-reader-visible'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BinderItemRow = {
  id: string
  bookId: string
  parentId: string | null
  type:
    | 'part' | 'chapter' | 'front_matter' | 'back_matter'
    | 'research_folder' | 'research_note' | 'character' | 'outline'
    | 'wiki_entry' | 'wiki_folder'
  title: string
  order: number
  content: unknown
  authorId: string | null
  lastEditedBy: string | null
  chapterId: string | null  // Populated for type === 'chapter'
  chapterStatus: ChapterStatus | null  // Populated for type === 'chapter' (or front/back matter)
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

/** Pure lookup: returns the book a binder item belongs to. */
async function getBinderItemBook(binderItemId: string): Promise<{ bookId: string }> {
  const row = await db.query.binderItems.findFirst({
    where: eq(binderItems.id, binderItemId),
    columns: { bookId: true },
  })
  if (!row) throw new Error('Binder item not found')
  return { bookId: row.bookId }
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

  // Fetch associated chapter IDs + status for chapter-type items
  const chapterItems = await db.query.chapters.findMany({
    where: eq(chapters.bookId, bookId),
    columns: { id: true, binderItemId: true, status: true },
  })
  const chapterByBinderId = new Map(
    chapterItems.map((c) => [c.binderItemId, { id: c.id, status: c.status }]),
  )

  const rows: BinderItemRow[] = items.map((item) => {
    const chapter =
      item.type === 'chapter' || item.type === 'front_matter' || item.type === 'back_matter'
        ? (chapterByBinderId.get(item.id) ?? null)
        : null
    return {
      id: item.id,
      bookId: item.bookId,
      parentId: item.parentId,
      type: item.type,
      title: item.title,
      order: item.order,
      content: item.content,
      authorId: item.authorId,
      lastEditedBy: item.lastEditedBy,
      chapterId: chapter?.id ?? null,
      chapterStatus: chapter?.status ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  })

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
  content?: Record<string, unknown> | null
}): Promise<ActionResult<{ id: string; chapterId: string | null }>> {
  const userId = await requireAuth()

  const parsed = createBinderItemSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await requireBinderCreatePermission(parsed.data.bookId, parsed.data.type, userId)

  if (await isBookOverflow(userId, parsed.data.bookId)) {
    return { success: false, error: 'FREE_LIMIT_REACHED' }
  }

  const binderId = createId()

  const result = await db.transaction(async (tx) => {
    await tx.insert(binderItems).values({
      id: binderId,
      bookId: parsed.data.bookId,
      parentId: parsed.data.parentId ?? null,
      type: parsed.data.type,
      title: parsed.data.title,
      order: parsed.data.order,
      content: parsed.data.content ?? null,
      authorId: userId,
      lastEditedBy: userId,
    })

    let chapterId: string | null = null

    // Editable-prose types all need a backing chapters row, otherwise the
    // editor's getChapterAction(item.chapterId!) call returns null and the
    // editor sits on the loading skeleton forever.
    if (
      parsed.data.type === 'chapter' ||
      parsed.data.type === 'front_matter' ||
      parsed.data.type === 'back_matter'
    ) {
      chapterId = createId()
      await tx.insert(chapters).values({
        id: chapterId,
        bookId: parsed.data.bookId,
        binderItemId: binderId,
      })
    }

    return { id: binderId, chapterId }
  })

  return { success: true, data: result }
}

/**
 * Updates a binder item's title or content (for research/character nodes).
 */
export async function updateBinderItemAction(
  id: string,
  input: { title?: string; content?: unknown; parentId?: string | null },
): Promise<ActionResult> {
  const userId = await requireAuth()

  const parsed = updateBinderItemSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { bookId: ownerBookId } = await getBinderItemBook(id)
  await requireBinderWritePermission(ownerBookId, id, userId)

  if (await isBookOverflow(userId, ownerBookId)) {
    return { success: false, error: 'FREE_LIMIT_REACHED' }
  }

  const updates: Record<string, unknown> = { lastEditedBy: userId }
  if (parsed.data.title !== undefined) updates.title = parsed.data.title
  if (parsed.data.content !== undefined) updates.content = parsed.data.content
  if (parsed.data.parentId !== undefined) updates.parentId = parsed.data.parentId

  // Only-lastEditedBy keys means no real change — bail without write.
  if (Object.keys(updates).length === 1) {
    return { success: true, data: undefined }
  }

  await db.update(binderItems).set({ ...updates, updatedAt: new Date() }).where(eq(binderItems.id, id))

  return { success: true, data: undefined }
}

/**
 * Deletes a binder item and, if it is a chapter, its associated chapter document.
 * The chapters.binderItemId FK uses onDelete: 'set null', so chapter rows must
 * be deleted explicitly to avoid orphaned documents.
 */
export async function deleteBinderItemAction(id: string): Promise<ActionResult> {
  const userId = await requireAuth()
  const { bookId } = await getBinderItemBook(id)
  await requireBinderWritePermission(bookId, id, userId)

  if (await isBookOverflow(userId, bookId)) {
    return { success: false, error: 'FREE_LIMIT_REACHED' }
  }

  // Delete child binder items and their associated chapter documents
  // (binder_items.parent_id uses onDelete: 'set null', not cascade)
  const children = await db
    .select({ id: binderItems.id, type: binderItems.type })
    .from(binderItems)
    .where(and(eq(binderItems.parentId, id), eq(binderItems.bookId, bookId)))

  for (const child of children) {
    if (child.type === 'chapter') {
      await db.delete(chapters).where(eq(chapters.binderItemId, child.id))
    }
    await db.delete(binderItems).where(eq(binderItems.id, child.id))
  }

  // Delete the chapter document for this item if it's a chapter
  await db.delete(chapters).where(eq(chapters.binderItemId, id))

  // Delete the item itself
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

  // Reorder operates across many items at once. We gate the whole batch by
  // the FIRST affected item's write permission. Mixed-type reorders that
  // would require different permissions per item are acceptable in v1
  // because the UI only emits reorders the user is allowed to make.
  await requireBinderWritePermission(bookId, parsed.data[0].id, userId)

  if (await isBookOverflow(userId, bookId)) {
    return { success: false, error: 'FREE_LIMIT_REACHED' }
  }

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
