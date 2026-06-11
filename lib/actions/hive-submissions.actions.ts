'use server'

import { db } from '@/db'
import {
  hiveSubmissions,
  hives,
  books,
  binderItems,
  chapters,
  userProfiles,
  hiveMembers,
  notifications,
} from '@/db/schema'
import { eq, and, isNull, asc, desc, gte, sql, inArray } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { requireAuth } from '@/lib/require-auth'
import {
  requireHiveMember,
  canSubmitChapter,
  canReviewSubmissions,
  type HiveRole,
} from '@/lib/hive/permissions'
import { recordHiveActivityTx, type DrizzleTx } from '@/lib/hive/record-activity'
import { shouldSkipNotification } from '@/lib/notifications/check-preferences'
import { extractWordCount } from '@/lib/tiptap-utils'
import {
  saveSubmissionDraftSchema,
  submitSubmissionSchema,
  approveSubmissionSchema,
  rejectSubmissionSchema,
  type SaveSubmissionDraftInput,
  type SubmitSubmissionInput,
  type ApproveSubmissionInput,
  type RejectSubmissionInput,
} from '@/lib/validations/hive-submission'
import type { ActionResult } from './book.actions'

// ── Public types ────────────────────────────────────────────────────────────

export type SubmissionDraftStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'

export type SubmissionRow = {
  id: string
  hiveId: string
  userId: string
  title: string
  content: unknown
  wordCount: number
  targetChapterOrder: number | null
  draftStatus: SubmissionDraftStatus
  createdChapterId: string | null
  reviewedBy: string | null
  reviewedAt: Date | null
  reviewNote: string | null
  createdAt: Date
  updatedAt: Date
  authorUsername: string | null
  authorAvatar: string | null
}

export type GetSubmissionData = {
  submission: SubmissionRow
  submitter: {
    userId: string
    username: string | null
    avatarUrl: string | null
  }
  book: {
    id: string
    title: string
  }
}

export type ListHiveSubmissionsData = {
  myDrafts: SubmissionRow[]
  mySubmissions: SubmissionRow[]
  allInHive: SubmissionRow[]
}

// ── saveSubmissionDraftAction ───────────────────────────────────────────────

export async function saveSubmissionDraftAction(
  input: SaveSubmissionDraftInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = saveSubmissionDraftSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { submissionId, hiveId, title, content, targetChapterOrder } = parsed.data

  let role: HiveRole
  try {
    role = await requireHiveMember(hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canSubmitChapter(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  const wordCount = extractWordCount(content)
  const now = new Date()

  if (submissionId) {
    const existing = await db.query.hiveSubmissions.findFirst({
      where: eq(hiveSubmissions.id, submissionId),
      columns: { id: true, userId: true, draftStatus: true, hiveId: true },
    })
    if (!existing) return { success: false, error: 'NOT_FOUND' }
    if (existing.userId !== userId) return { success: false, error: 'NOT_AUTHORIZED' }
    if (existing.draftStatus !== 'DRAFT') {
      return { success: false, error: 'SUBMISSION_LOCKED' }
    }

    await db
      .update(hiveSubmissions)
      .set({
        title,
        content,
        wordCount,
        targetChapterOrder,
        updatedAt: now,
      })
      .where(eq(hiveSubmissions.id, submissionId))

    return { success: true, data: { id: submissionId } }
  }

  const newId = createId()
  await db.insert(hiveSubmissions).values({
    id: newId,
    hiveId,
    userId,
    title,
    content,
    wordCount,
    targetChapterOrder,
    draftStatus: 'DRAFT',
  })

  return { success: true, data: { id: newId } }
}

// ── submitSubmissionAction ──────────────────────────────────────────────────

export async function submitSubmissionAction(
  input: SubmitSubmissionInput,
): Promise<ActionResult> {
  const userId = await requireAuth()
  const parsed = submitSubmissionSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { id } = parsed.data

  const submission = await db.query.hiveSubmissions.findFirst({
    where: eq(hiveSubmissions.id, id),
    columns: {
      id: true,
      hiveId: true,
      userId: true,
      title: true,
      wordCount: true,
      draftStatus: true,
    },
  })
  if (!submission) return { success: false, error: 'NOT_FOUND' }

  let role: HiveRole
  try {
    role = await requireHiveMember(submission.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canSubmitChapter(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  if (submission.userId !== userId) return { success: false, error: 'NOT_AUTHORIZED' }
  if (submission.draftStatus !== 'DRAFT') {
    return { success: false, error: 'INVALID_STATE' }
  }
  if (submission.title.trim() === '') {
    return { success: false, error: 'TITLE_REQUIRED' }
  }

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(hiveSubmissions)
      .set({ draftStatus: 'PENDING', updatedAt: now })
      .where(eq(hiveSubmissions.id, id))

    // Activity payload shape (top-level only — DRAFT→PENDING transition):
    //   { submissionId, title, wordCount }
    await recordHiveActivityTx(tx as DrizzleTx, {
      hiveId: submission.hiveId,
      actorId: userId,
      type: 'chapter_submitted',
      subjectId: id,
      payload: {
        submissionId: id,
        title: submission.title,
        wordCount: submission.wordCount,
      },
    })

    // HIVE_SUBMISSION notification — fan-out to OWNER + MOD reviewers.
    // Skips the submitter themselves and any reviewer that opted out.
    const reviewers = await tx.query.hiveMembers.findMany({
      where: and(
        eq(hiveMembers.hiveId, submission.hiveId),
        inArray(hiveMembers.role, ['OWNER', 'MODERATOR']),
      ),
      columns: { userId: true },
    })
    const otherReviewers = reviewers.filter((r) => r.userId !== userId)
    if (otherReviewers.length > 0) {
      const skipResults = await Promise.all(
        otherReviewers.map((r) =>
          shouldSkipNotification(r.userId, 'HIVE_SUBMISSION'),
        ),
      )
      const filteredReviewers = otherReviewers.filter((_, i) => !skipResults[i])
      if (filteredReviewers.length > 0) {
        await tx.insert(notifications).values(
          filteredReviewers.map((r) => ({
            id: createId(),
            userId: r.userId,
            type: 'HIVE_SUBMISSION' as const,
            actorId: userId,
            resourceType: 'hive_submission',
            resourceId: id,
          })),
        )
      }
    }
  })

  return { success: true, data: undefined }
}

// ── approveSubmissionAction ─────────────────────────────────────────────────

/**
 * Privileged binder-create path. Reviewers (OWNER/MODERATOR) approve a
 * pending submission, which inserts a new binder item + chapter pair for the
 * book — using the submitter's userId as the chapter author.
 *
 * This intentionally does NOT call `requireBinderWritePermission` /
 * `requireBinderCreatePermission`: those helpers gate ad-hoc binder writes
 * (chapters are author-only there). The H3 submission flow is the sanctioned
 * path for non-author chapter creation, so the role-gate here is
 * `canReviewSubmissions(role)` and the privileged DB writes happen directly.
 */
export async function approveSubmissionAction(
  input: ApproveSubmissionInput,
): Promise<ActionResult<{ chapterId: string; binderItemId: string }>> {
  const userId = await requireAuth()
  const parsed = approveSubmissionSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { id, reviewNote } = parsed.data

  const submission = await db.query.hiveSubmissions.findFirst({
    where: eq(hiveSubmissions.id, id),
    columns: {
      id: true,
      hiveId: true,
      userId: true,
      title: true,
      content: true,
      wordCount: true,
      targetChapterOrder: true,
      draftStatus: true,
    },
  })
  if (!submission) return { success: false, error: 'NOT_FOUND' }

  let role: HiveRole
  try {
    role = await requireHiveMember(submission.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canReviewSubmissions(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  if (submission.draftStatus !== 'PENDING') {
    return { success: false, error: 'INVALID_STATE' }
  }

  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, submission.hiveId),
    columns: { id: true, bookId: true },
  })
  if (!hive) return { success: false, error: 'NOT_FOUND' }

  const book = await db.query.books.findFirst({
    where: eq(books.id, hive.bookId),
    columns: { id: true },
  })
  if (!book) return { success: false, error: 'NOT_FOUND' }

  const now = new Date()
  const binderItemId = createId()
  const chapterId = createId()

  const result = await db.transaction(async (tx) => {
    // Compute insertion order.
    let insertOrder: number
    if (submission.targetChapterOrder === null) {
      const maxRow = await tx
        .select({ maxOrder: sql<number | null>`max(${binderItems.order})` })
        .from(binderItems)
        .where(and(eq(binderItems.bookId, book.id), isNull(binderItems.parentId)))
      const currentMax = maxRow[0]?.maxOrder ?? null
      insertOrder = (currentMax ?? -1) + 1
    } else {
      // Shift siblings at parentId IS NULL whose order >= target by +1.
      await tx
        .update(binderItems)
        .set({ order: sql`${binderItems.order} + 1` })
        .where(
          and(
            eq(binderItems.bookId, book.id),
            isNull(binderItems.parentId),
            gte(binderItems.order, submission.targetChapterOrder),
          ),
        )
      insertOrder = submission.targetChapterOrder
    }

    await tx.insert(binderItems).values({
      id: binderItemId,
      bookId: book.id,
      parentId: null,
      type: 'chapter',
      title: submission.title,
      order: insertOrder,
      content: null,
      authorId: submission.userId,
      lastEditedBy: submission.userId,
    })

    await tx.insert(chapters).values({
      id: chapterId,
      bookId: book.id,
      binderItemId,
      content: submission.content,
      wordCount: submission.wordCount,
      authorUserId: submission.userId,
      status: 'FIRST_DRAFT',
    })

    await tx
      .update(hiveSubmissions)
      .set({
        draftStatus: 'APPROVED',
        createdChapterId: chapterId,
        reviewedBy: userId,
        reviewedAt: now,
        reviewNote: reviewNote ?? null,
        updatedAt: now,
      })
      .where(eq(hiveSubmissions.id, id))

    // Activity payload shape (privileged approve path):
    //   { submissionId, chapterId, title, wordCount, submitterUserId }
    await recordHiveActivityTx(tx as DrizzleTx, {
      hiveId: submission.hiveId,
      actorId: userId,
      type: 'chapter_submitted_approved',
      subjectId: id,
      payload: {
        submissionId: id,
        chapterId,
        title: submission.title,
        wordCount: submission.wordCount,
        submitterUserId: submission.userId,
      },
    })

    return { chapterId, binderItemId }
  })

  return { success: true, data: result }
}

// ── rejectSubmissionAction ──────────────────────────────────────────────────

export async function rejectSubmissionAction(
  input: RejectSubmissionInput,
): Promise<ActionResult> {
  const userId = await requireAuth()
  const parsed = rejectSubmissionSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { id, reviewNote } = parsed.data

  const submission = await db.query.hiveSubmissions.findFirst({
    where: eq(hiveSubmissions.id, id),
    columns: {
      id: true,
      hiveId: true,
      userId: true,
      title: true,
      draftStatus: true,
    },
  })
  if (!submission) return { success: false, error: 'NOT_FOUND' }

  let role: HiveRole
  try {
    role = await requireHiveMember(submission.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canReviewSubmissions(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  if (submission.draftStatus !== 'PENDING') {
    return { success: false, error: 'INVALID_STATE' }
  }

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(hiveSubmissions)
      .set({
        draftStatus: 'REJECTED',
        reviewedBy: userId,
        reviewedAt: now,
        reviewNote,
        updatedAt: now,
      })
      .where(eq(hiveSubmissions.id, id))

    // Activity payload shape (reject path):
    //   { submissionId, title, reviewNote }
    await recordHiveActivityTx(tx as DrizzleTx, {
      hiveId: submission.hiveId,
      actorId: userId,
      type: 'chapter_submitted_rejected',
      subjectId: id,
      payload: {
        submissionId: id,
        title: submission.title,
        reviewNote,
      },
    })
  })

  return { success: true, data: undefined }
}

// ── getSubmissionAction ─────────────────────────────────────────────────────

export async function getSubmissionAction(
  id: string,
): Promise<ActionResult<GetSubmissionData>> {
  const userId = await requireAuth()

  const submission = await db.query.hiveSubmissions.findFirst({
    where: eq(hiveSubmissions.id, id),
  })
  if (!submission) return { success: false, error: 'NOT_FOUND' }

  let role: HiveRole
  try {
    role = await requireHiveMember(submission.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  // Visibility: submitter OR reviewer.
  if (submission.userId !== userId && !canReviewSubmissions(role)) {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, submission.hiveId),
    columns: { bookId: true },
  })
  if (!hive) return { success: false, error: 'NOT_FOUND' }

  const book = await db.query.books.findFirst({
    where: eq(books.id, hive.bookId),
    columns: { id: true, title: true },
  })
  if (!book) return { success: false, error: 'NOT_FOUND' }

  const submitter = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, submission.userId),
    columns: { userId: true, username: true, avatarUrl: true },
  })

  const data: GetSubmissionData = {
    submission: {
      id: submission.id,
      hiveId: submission.hiveId,
      userId: submission.userId,
      title: submission.title,
      content: submission.content,
      wordCount: submission.wordCount,
      targetChapterOrder: submission.targetChapterOrder,
      draftStatus: submission.draftStatus as SubmissionDraftStatus,
      createdChapterId: submission.createdChapterId,
      reviewedBy: submission.reviewedBy,
      reviewedAt: submission.reviewedAt,
      reviewNote: submission.reviewNote,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
      authorUsername: submitter?.username ?? null,
      authorAvatar: submitter?.avatarUrl ?? null,
    },
    submitter: {
      userId: submission.userId,
      username: submitter?.username ?? null,
      avatarUrl: submitter?.avatarUrl ?? null,
    },
    book: { id: book.id, title: book.title },
  }
  return { success: true, data }
}

// ── listHiveSubmissionsAction ───────────────────────────────────────────────

export async function listHiveSubmissionsAction(
  hiveId: string,
): Promise<ActionResult<ListHiveSubmissionsData>> {
  const userId = await requireAuth()

  let role: HiveRole
  try {
    role = await requireHiveMember(hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  const reviewer = canReviewSubmissions(role)

  // Fetch the union of rows we need in one or two queries.
  const myRows = await db.query.hiveSubmissions.findMany({
    where: and(
      eq(hiveSubmissions.hiveId, hiveId),
      eq(hiveSubmissions.userId, userId),
    ),
    orderBy: [desc(hiveSubmissions.updatedAt)],
  })

  let allHiveRows: typeof myRows = []
  if (reviewer) {
    allHiveRows = await db.query.hiveSubmissions.findMany({
      where: eq(hiveSubmissions.hiveId, hiveId),
    })
  }

  // Resolve profiles for all distinct userIds.
  const distinctUserIds = Array.from(
    new Set([...myRows, ...allHiveRows].map((r) => r.userId)),
  )
  const profiles = distinctUserIds.length
    ? await db.query.userProfiles.findMany({
        where: inArray(userProfiles.userId, distinctUserIds),
        columns: { userId: true, username: true, avatarUrl: true },
      })
    : []
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]))

  function toRow(r: (typeof myRows)[number]): SubmissionRow {
    const prof = profileByUserId.get(r.userId)
    return {
      id: r.id,
      hiveId: r.hiveId,
      userId: r.userId,
      title: r.title,
      content: r.content,
      wordCount: r.wordCount,
      targetChapterOrder: r.targetChapterOrder,
      draftStatus: r.draftStatus as SubmissionDraftStatus,
      createdChapterId: r.createdChapterId,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt,
      reviewNote: r.reviewNote,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      authorUsername: prof?.username ?? null,
      authorAvatar: prof?.avatarUrl ?? null,
    }
  }

  const myDrafts = myRows.filter((r) => r.draftStatus === 'DRAFT').map(toRow)
  const mySubmissions = myRows
    .filter((r) => r.draftStatus !== 'DRAFT')
    .map(toRow)

  // allInHive: PENDING (asc createdAt) first, then APPROVED+REJECTED (desc reviewedAt).
  const pending = allHiveRows
    .filter((r) => r.draftStatus === 'PENDING')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(toRow)
  const reviewed = allHiveRows
    .filter(
      (r) => r.draftStatus === 'APPROVED' || r.draftStatus === 'REJECTED',
    )
    .sort((a, b) => {
      const at = a.reviewedAt?.getTime() ?? 0
      const bt = b.reviewedAt?.getTime() ?? 0
      return bt - at
    })
    .map(toRow)

  return {
    success: true,
    data: {
      myDrafts,
      mySubmissions,
      allInHive: reviewer ? [...pending, ...reviewed] : [],
    },
  }
}
