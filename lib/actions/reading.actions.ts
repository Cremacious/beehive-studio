'use server'

import { db } from '@/db'
import { readingProgress, binderItems, chapters } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import type { ActionResult } from './book.actions'

export type ReadingProgressResult = {
  lastChapterId: string | null
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

  const [currentChapter] = await db
    .select({ binderItemId: chapters.binderItemId })
    .from(chapters)
    .where(eq(chapters.id, progress.chapterId))
    .limit(1)

  if (!currentChapter?.binderItemId) {
    return { success: true, data: { lastChapterId: progress.chapterId, readChapterBinderItemIds: [] } }
  }

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
