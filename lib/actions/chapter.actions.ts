'use server'

import { db } from '@/db'
import { books, chapters, chapterSnapshots } from '@/db/schema'
import { eq } from 'drizzle-orm'
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
 * Returns the chapter and bookId for further processing.
 */
async function assertChapterOwner(chapterId: string, userId: string) {
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
