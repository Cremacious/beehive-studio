'use server'

import { db } from '@/db'
import { hiveChapterLocks, hiveComments, notifications, chapters } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { assertHiveMember } from './_helpers'
import type { ActionResult } from './book.actions'

export type CommentRow = {
  id: string
  chapterId: string
  authorId: string
  anchorStart: string | null
  anchorEnd: string | null
  content: string
  resolved: Date | null
  createdAt: Date
  author: { name: string | null; image: string | null }
}

export async function lockChapterAction(hiveId: string, chapterId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  await db.insert(hiveChapterLocks)
    .values({ chapterId, userId })
    .onConflictDoUpdate({ target: hiveChapterLocks.chapterId, set: { userId, lockedAt: new Date() } })
  return { success: true, data: undefined }
}

export async function unlockChapterAction(chapterId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await db.delete(hiveChapterLocks)
    .where(and(eq(hiveChapterLocks.chapterId, chapterId), eq(hiveChapterLocks.userId, userId)))
  return { success: true, data: undefined }
}

export async function getHiveChapterLocksAction(hiveId: string): Promise<ActionResult<Record<string, { userId: string; lockedAt: Date }>>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)

  const locks = await db.query.hiveChapterLocks.findMany({
    with: { chapter: { columns: { binderItemId: true } } },
  })

  const map: Record<string, { userId: string; lockedAt: Date }> = {}
  for (const lock of locks) {
    if (lock.chapter?.binderItemId) {
      map[lock.chapter.binderItemId] = { userId: lock.userId, lockedAt: lock.lockedAt }
    }
  }
  return { success: true, data: map }
}

export async function createHiveCommentAction(
  hiveId: string,
  chapterId: string,
  content: string,
  anchorStart?: string,
  anchorEnd?: string,
): Promise<ActionResult<{ commentId: string }>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)

  const [comment] = await db.insert(hiveComments)
    .values({ hiveId, chapterId, authorId: userId, content, anchorStart: anchorStart ?? null, anchorEnd: anchorEnd ?? null })
    .returning({ id: hiveComments.id })

  const chapter = await db.query.chapters.findFirst({
    where: eq(chapters.id, chapterId),
    with: { book: { columns: { userId: true } } },
  })
  if (chapter?.book?.userId && chapter.book.userId !== userId) {
    await db.insert(notifications).values({
      userId: chapter.book.userId,
      type: 'HIVE_COMMENT',
      actorId: userId,
      resourceType: 'chapter',
      resourceId: chapterId,
    })
  }

  return { success: true, data: { commentId: comment.id } }
}

export async function resolveHiveCommentAction(commentId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await db.update(hiveComments)
    .set({ resolved: new Date() })
    .where(eq(hiveComments.id, commentId))
  return { success: true, data: undefined }
}

export async function getChapterCommentsAction(chapterId: string): Promise<ActionResult<CommentRow[]>> {
  const userId = await requireAuth()
  const rows = await db.query.hiveComments.findMany({
    where: eq(hiveComments.chapterId, chapterId),
    with: { author: { columns: { name: true, image: true } } },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  })
  return { success: true, data: rows as CommentRow[] }
}
