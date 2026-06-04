'use server'

import { db } from '@/db'
import { books, chapters, chapterSnapshots, hiveAnnotations, hiveSuggestions } from '@/db/schema'
import { eq, desc, count, and, isNull } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { getUserPremiumStatus } from '@/lib/premium'
import { isBookOverflow } from '@/lib/billing/book-overflow'
import { extractWordCount } from '@/lib/tiptap-utils'
import { updateChapterNotesSchema, chapterStatusSchema, updateChapterWordGoalSchema } from '@/lib/validations/book'
import { logHiveWordDelta } from '@/lib/hive/log-word-delta'
import { getBookHive } from '@/lib/hive/get-book-hive'
import { recordSocialActivityTx } from '@/lib/social/record-activity'
import type { ActionResult } from './book.actions'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChapterData = {
  id: string
  bookId: string
  binderItemId: string | null
  content: unknown
  wordCount: number
  wordGoal: number
  status: 'IDEA' | 'OUTLINE' | 'FIRST_DRAFT' | 'REVISED' | 'FINAL'
  notes: string | null
  createdAt: Date
  updatedAt: Date
  annotationCount: number
  pendingSuggestionCount: number
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

  // Hive activity counts. Skip the queries entirely when the book has no
  // linked hive — the vast majority of books aren't in hives and we don't
  // want two extra round-trips per chapter load for them. getBookHive is
  // React-cached so repeated calls in the same request are free.
  const hive = await getBookHive(chapter.bookId)
  let annotationCount = 0
  let pendingSuggestionCount = 0
  if (hive) {
    const [annRow] = await db
      .select({ c: count() })
      .from(hiveAnnotations)
      .where(and(
        eq(hiveAnnotations.chapterId, chapterId),
        isNull(hiveAnnotations.parentId),
        eq(hiveAnnotations.resolved, false),
      ))
    annotationCount = Number(annRow?.c ?? 0)

    const [sugRow] = await db
      .select({ c: count() })
      .from(hiveSuggestions)
      .where(and(
        eq(hiveSuggestions.chapterId, chapterId),
        eq(hiveSuggestions.resolved, false),
        isNull(hiveSuggestions.parentId),
      ))
    pendingSuggestionCount = Number(sugRow?.c ?? 0)
  }

  return {
    success: true,
    data: {
      id: chapter.id,
      bookId: chapter.bookId,
      binderItemId: chapter.binderItemId,
      content: chapter.content,
      wordCount: chapter.wordCount,
      wordGoal: chapter.wordGoal,
      status: chapter.status,
      notes: chapter.notes,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt,
      annotationCount,
      pendingSuggestionCount,
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

  if (await isBookOverflow(userId, chapter.bookId)) {
    return { success: false, error: 'FREE_LIMIT_REACHED' }
  }

  if (typeof content !== 'object' || content === null || (content as Record<string, unknown>).type !== 'doc') {
    return { success: false, error: 'Invalid chapter content format' }
  }

  const wordCount = extractWordCount(content)

  await db.transaction(async (tx) => {
    await tx
      .update(chapters)
      .set({ content, wordCount, updatedAt: new Date() })
      .where(eq(chapters.id, chapterId))

    // Update book's updatedAt so the dashboard shows correct last-edited time
    await tx
      .update(books)
      .set({ updatedAt: new Date() })
      .where(eq(books.id, chapter.bookId))
  })

  // Create snapshot for premium users (outside transaction — snapshot failure must not roll back the save)
  const isPremium = await getUserPremiumStatus(userId)
  if (isPremium) {
    const recent = await db.query.chapterSnapshots.findFirst({
      where: eq(chapterSnapshots.chapterId, chapterId),
      orderBy: [desc(chapterSnapshots.createdAt)],
      columns: { createdAt: true },
    })

    const sixtySecondsAgo = new Date(Date.now() - 60_000)
    if (!recent || recent.createdAt < sixtySecondsAgo) {
      await db.insert(chapterSnapshots).values({
        chapterId,
        content,
        wordCount,
      })
    }
  }

  // Hive word-log throttle — same posture as the snapshot block above:
  //   outside the chapter tx, swallowed errors, 60s window per (user, chapter).
  await logHiveWordDelta({
    bookId: chapter.bookId,
    userId,
    chapterId,
    currentWordCount: wordCount,
  })

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

  const parsed = chapterStatusSchema.safeParse(status)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { chapter, bookId } = await assertChapterOwner(chapterId, userId)
  const priorStatus = chapter.status
  const newStatus = parsed.data

  await db.transaction(async (tx) => {
    await tx
      .update(chapters)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(chapters.id, chapterId))

    // C1 T8 hook: chapter_posted. Fires only when status TRANSITIONS into REVISED/FINAL
    // (prior was something else) AND parent book is PUBLIC+discoverable. Spec §3.4.
    const transitionsIntoVisible =
      (newStatus === 'REVISED' || newStatus === 'FINAL') &&
      priorStatus !== newStatus
    if (transitionsIntoVisible) {
      const [book] = await tx
        .select({ visibility: books.visibility, discoverable: books.discoverable })
        .from(books)
        .where(eq(books.id, bookId))
        .limit(1)
      if (book && book.visibility === 'PUBLIC' && book.discoverable === true) {
        await recordSocialActivityTx(tx, {
          actorId: userId,
          type: 'chapter_posted',
          subjectType: 'chapter',
          subjectId: chapter.binderItemId ?? chapterId,
          payload: { bookId, status: newStatus },
        })
      }
    }
  })

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

/**
 * Updates the chapter's word goal (per-chapter writing target).
 * 0 means "no goal set"; max enforced at 1,000,000.
 */
export async function updateChapterWordGoalAction(
  chapterId: string,
  wordGoal: number,
): Promise<ActionResult> {
  const userId = await requireAuth()

  const parsed = updateChapterWordGoalSchema.safeParse({ wordGoal })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  await assertChapterOwner(chapterId, userId)

  await db
    .update(chapters)
    .set({ wordGoal: parsed.data.wordGoal, updatedAt: new Date() })
    .where(eq(chapters.id, chapterId))

  return { success: true, data: undefined }
}
