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
