'use server'

import { db } from '@/db'
import { readingProgress, chapterReads, chapters } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { canReadBook } from '@/lib/books/can-read'
import type { ActionResult } from './book.actions'
import { runAction } from './safe-action'

export type ReadingProgressResult = {
  lastChapterId: string | null
  readChapterBinderItemIds: string[]
}

export async function markChapterReadAction(
  bookId: string,
  chapterBinderItemId: string
): Promise<ActionResult<void>> {
  return runAction(async () => {
  const userId = await requireAuth()

  const access = await canReadBook(bookId, userId)
  if (!access.ok) return { success: false, error: 'FORBIDDEN' }

  // Resolve chapters.id (cursor PK) from the binder item id.
  const [chapterRow] = await db
    .select({ chapterId: chapters.id })
    .from(chapters)
    .where(eq(chapters.binderItemId, chapterBinderItemId))
    .limit(1)

  const now = new Date()

  // Idempotent insert into the read set.
  await db
    .insert(chapterReads)
    .values({ userId, bookId, chapterBinderItemId, readAt: now })
    .onConflictDoNothing({
      target: [chapterReads.userId, chapterReads.chapterBinderItemId],
    })

  // Cursor upsert is preserved so "Continue Reading" and the auto-mark
  // from /read/[chapterId] keep working uninterrupted. If we can't resolve
  // the chapters.id row (race condition or stale id), the cursor write is
  // skipped — the read set still records the intent.
  if (chapterRow?.chapterId) {
    await db
      .insert(readingProgress)
      .values({ userId, bookId, chapterId: chapterRow.chapterId, lastOpenedAt: now })
      .onConflictDoUpdate({
        target: [readingProgress.userId, readingProgress.bookId],
        set: { chapterId: chapterRow.chapterId, lastOpenedAt: now },
      })
  }

  return { success: true, data: undefined }
  })
}

export async function unmarkChapterReadAction(
  bookId: string,
  chapterBinderItemId: string
): Promise<ActionResult<void>> {
  return runAction(async () => {
  const userId = await requireAuth()

  const access = await canReadBook(bookId, userId)
  if (!access.ok) return { success: false, error: 'FORBIDDEN' }

  await db
    .delete(chapterReads)
    .where(
      and(
        eq(chapterReads.userId, userId),
        eq(chapterReads.chapterBinderItemId, chapterBinderItemId)
      )
    )

  // Deliberately do NOT touch readingProgress — the cursor is a separate
  // concern from the read set, and unmarking a chapter shouldn't reset
  // "Continue Reading".
  return { success: true, data: undefined }
  })
}

export async function getReadingProgressAction(
  bookId: string
): Promise<ActionResult<ReadingProgressResult>> {
  return runAction(async () => {
  const userId = await requireAuth()

  const access = await canReadBook(bookId, userId)
  if (!access.ok) return { success: false, error: 'FORBIDDEN' }

  const [progress] = await db
    .select({ chapterId: readingProgress.chapterId })
    .from(readingProgress)
    .where(and(eq(readingProgress.userId, userId), eq(readingProgress.bookId, bookId)))
    .limit(1)

  const reads = await db
    .select({ chapterBinderItemId: chapterReads.chapterBinderItemId })
    .from(chapterReads)
    .where(and(eq(chapterReads.userId, userId), eq(chapterReads.bookId, bookId)))

  return {
    success: true,
    data: {
      lastChapterId: progress?.chapterId ?? null,
      readChapterBinderItemIds: reads.map((r) => r.chapterBinderItemId),
    },
  }
  })
}
