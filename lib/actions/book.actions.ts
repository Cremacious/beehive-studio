'use server'

import { db } from '@/db'
import {
  books, binderItems, chapters, bookTemplates,
} from '@/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { assertBookOwner } from './_helpers'
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

  await db.transaction(async (tx) => {
    await tx.insert(books).values({
      id: bookId,
      userId,
      title: parsed.data.title,
      genre: parsed.data.genre ?? null,
    })

    if (parsed.data.templateId) {
      // Apply template structure
      const [template] = await tx
        .select()
        .from(bookTemplates)
        .where(eq(bookTemplates.id, parsed.data.templateId))

      if (template?.structure) {
        const structure = template.structure as {
          parts?: Array<{ title: string; chapterCount: number }>
          researchFolders?: string[]
        }

        let globalOrder = 0

        // Create parts and their chapters
        for (const part of structure.parts ?? []) {
          const partId = createId()
          await tx.insert(binderItems).values({
            id: partId,
            bookId,
            type: 'part',
            title: part.title,
            order: globalOrder++,
          })

          for (let i = 0; i < (part.chapterCount ?? 1); i++) {
            const chapterBinderId = createId()
            const chapterId = createId()

            await tx.insert(binderItems).values({
              id: chapterBinderId,
              bookId,
              parentId: partId,
              type: 'chapter',
              title: `Chapter ${i + 1}`,
              order: i,
            })

            await tx.insert(chapters).values({
              id: chapterId,
              bookId,
              binderItemId: chapterBinderId,
            })
          }
        }

        // Create research folders
        for (const folderName of structure.researchFolders ?? []) {
          await tx.insert(binderItems).values({
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

      await tx.insert(binderItems).values({
        id: chapterBinderId,
        bookId,
        type: 'chapter',
        title: 'Chapter 1',
        order: 0,
      })

      await tx.insert(chapters).values({
        id: chapterId,
        bookId,
        binderItemId: chapterBinderId,
      })
    }
  })

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
