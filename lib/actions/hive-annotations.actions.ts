'use server'

import { db } from '@/db'
import {
  hiveAnnotations,
  hives,
  chapters,
  books,
  binderItems,
  userProfiles,
} from '@/db/schema'
import { eq, and, asc, desc, isNull, inArray } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import {
  requireHiveMember,
  canAnnotate,
  canResolveAnnotation,
} from '@/lib/hive/permissions'
import {
  recordHiveActivityTx,
  type DrizzleTx,
} from '@/lib/hive/record-activity'
import { extractMentionUsernamesFromText } from '@/lib/mentions/extract-mentions'
import { resolveMentionedUsers } from '@/lib/mentions/resolve-mentions'
import { recordMentionNotificationsTx } from '@/lib/mentions/record-mention-notifications'
import {
  createAnnotationSchema,
  replyToAnnotationSchema,
  type CreateAnnotationInput,
  type ReplyToAnnotationInput,
} from '@/lib/validations/hive-annotation'
import { findOrphanMarks, type PMNode } from '@/lib/tiptap-extensions/mark-scanning'
import { patchDocWithMark } from '@/lib/tiptap-extensions/patch-mark'
import { stripMarkById } from '@/lib/tiptap-extensions/strip-mark'
import type { ActionResult } from './book.actions'

// ── Public types ─────────────────────────────────────────────────────────────

export type AnnotationLayer = 'GRAMMAR' | 'PLOT' | 'TONE' | 'CONTINUITY' | 'GENERAL'

export type AnnotationRow = {
  id: string
  hiveId: string
  chapterId: string
  authorId: string
  parentId: string | null
  layer: AnnotationLayer
  selectionStart: number | null
  selectionEnd: number | null
  selectedText: string | null
  body: string
  resolved: boolean
  resolvedBy: string | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
  author: {
    userId: string
    username: string | null
    avatarUrl: string | null
    displayName: string | null
  }
  resolver: {
    userId: string
    username: string | null
    avatarUrl: string | null
    displayName: string | null
  } | null
}

export type GetChapterAnnotationsData = {
  annotations: AnnotationRow[]
  orphanRowIds: string[]
}

// ── createAnnotationAction ───────────────────────────────────────────────────

export async function createAnnotationAction(
  input: CreateAnnotationInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = createAnnotationSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { hiveId, chapterId, layer, body, selectionStart, selectionEnd, selectedText } = parsed.data

  let role
  try {
    role = await requireHiveMember(hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canAnnotate(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  // Verify chapter belongs to the hive's book.
  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { bookId: true },
  })
  if (!hive) return { success: false, error: 'NOT_FOUND' }
  const chapter = await db.query.chapters.findFirst({
    where: eq(chapters.id, chapterId),
    columns: { id: true, bookId: true, content: true },
  })
  if (!chapter || chapter.bookId !== hive.bookId) {
    return { success: false, error: 'NOT_FOUND' }
  }

  // Mention extraction + early cap check (before tx)
  const textUsernames = extractMentionUsernamesFromText(body)
  if (textUsernames.length > 5) {
    return { success: false, error: 'MENTION_CAP_EXCEEDED' }
  }

  const result = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(hiveAnnotations)
      .values({
        hiveId,
        chapterId,
        authorId: userId,
        parentId: null,
        layer,
        selectionStart,
        selectionEnd,
        selectedText: selectedText ?? null,
        body,
      })
      .returning({ id: hiveAnnotations.id })
    const newId = inserted.id

    // Patch chapter content with the annotation mark. selectionStart/End
    // come from editor.state.selection — ProseMirror positions — which is the
    // coordinate system patchDocWithMark walks natively (atom-aware).
    const doc = (chapter.content ?? { type: 'doc', content: [] }) as PMNode
    const nextDoc = patchDocWithMark(
      doc,
      'hiveAnnotation',
      { annotationId: newId, layer },
      selectionStart,
      selectionEnd,
    )
    await tx
      .update(chapters)
      .set({ content: nextDoc, updatedAt: new Date() })
      .where(eq(chapters.id, chapterId))

    // Activity payload shape (top-level annotation only — replies don't fire):
    //   { annotationId, chapterId, layer, excerpt }
    await recordHiveActivityTx(tx as DrizzleTx, {
      hiveId,
      actorId: userId,
      type: 'annotation_added',
      subjectId: newId,
      payload: {
        annotationId: newId,
        chapterId,
        layer,
        excerpt: (selectedText ?? '').slice(0, 80),
      },
    })

    // Mention notifications
    if (textUsernames.length > 0) {
      const mentionResult = await resolveMentionedUsers({
        tiptapUserIds: [],
        textUsernames,
        actorId: userId,
        resourceType: 'hive_annotation',
        resourceId: newId,
      })
      if (!mentionResult.ok) {
        throw new Error(mentionResult.error)
      }
      const toNotify = mentionResult.users
        .filter((u) => !mentionResult.alreadyNotified.has(u.userId))
        .map((u) => u.userId)
      if (toNotify.length > 0) {
        await recordMentionNotificationsTx(tx, {
          actorId: userId,
          mentionedUserIds: toNotify,
          resourceType: 'hive_annotation',
          resourceId: newId,
        })
      }
    }

    return newId
  })

  return { success: true, data: { id: result } }
}

// ── replyToAnnotationAction ──────────────────────────────────────────────────

export async function replyToAnnotationAction(
  input: ReplyToAnnotationInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = replyToAnnotationSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { parentId, body } = parsed.data

  const parent = await db.query.hiveAnnotations.findFirst({
    where: eq(hiveAnnotations.id, parentId),
    columns: {
      id: true,
      hiveId: true,
      chapterId: true,
      layer: true,
      parentId: true,
    },
  })
  if (!parent) return { success: false, error: 'NOT_FOUND' }

  let role
  try {
    role = await requireHiveMember(parent.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canAnnotate(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  // Mention extraction + early cap check (before tx)
  const textUsernames = extractMentionUsernamesFromText(body)
  if (textUsernames.length > 5) {
    return { success: false, error: 'MENTION_CAP_EXCEEDED' }
  }

  const insertedId = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(hiveAnnotations)
      .values({
        hiveId: parent.hiveId,
        chapterId: parent.chapterId,
        authorId: userId,
        parentId: parent.id,
        layer: parent.layer,
        selectionStart: null,
        selectionEnd: null,
        selectedText: null,
        body,
      })
      .returning({ id: hiveAnnotations.id })
    const newId = inserted.id

    // Mention notifications — replies use the parent annotation as the resource
    // (no separate surface type for annotation replies).
    if (textUsernames.length > 0) {
      const mentionResult = await resolveMentionedUsers({
        tiptapUserIds: [],
        textUsernames,
        actorId: userId,
        resourceType: 'hive_annotation',
        resourceId: newId,
      })
      if (!mentionResult.ok) {
        throw new Error(mentionResult.error)
      }
      const toNotify = mentionResult.users
        .filter((u) => !mentionResult.alreadyNotified.has(u.userId))
        .map((u) => u.userId)
      if (toNotify.length > 0) {
        await recordMentionNotificationsTx(tx, {
          actorId: userId,
          mentionedUserIds: toNotify,
          resourceType: 'hive_annotation',
          resourceId: newId,
        })
      }
    }

    return newId
  })

  // No activity event for replies.
  return { success: true, data: { id: insertedId } }
}

// ── resolveAnnotationAction / unresolveAnnotationAction ─────────────────────

async function setAnnotationResolved(
  annotationId: string,
  resolved: boolean,
): Promise<ActionResult> {
  const userId = await requireAuth()

  const ann = await db.query.hiveAnnotations.findFirst({
    where: eq(hiveAnnotations.id, annotationId),
    columns: { id: true, hiveId: true, chapterId: true, authorId: true },
  })
  if (!ann) return { success: false, error: 'NOT_FOUND' }

  const chapter = await db.query.chapters.findFirst({
    where: eq(chapters.id, ann.chapterId),
    columns: { id: true, bookId: true, content: true },
  })
  if (!chapter) return { success: false, error: 'NOT_FOUND' }
  const book = await db.query.books.findFirst({
    where: eq(books.id, chapter.bookId),
    columns: { userId: true },
  })
  if (!book) return { success: false, error: 'NOT_FOUND' }

  let role
  try {
    role = await requireHiveMember(ann.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  if (!canResolveAnnotation({ authorId: ann.authorId }, role, userId, book.userId)) {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  await db
    .update(hiveAnnotations)
    .set({
      resolved,
      resolvedBy: resolved ? userId : null,
      resolvedAt: resolved ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(hiveAnnotations.id, annotationId))

  // When resolving, strip the highlight from the chapter content so reader
  // surfaces (including a future re-open of the studio editor) no longer
  // render the mark. Unresolve leaves content untouched — restoring the mark
  // would require knowing the original range, and unresolve is rare.
  if (resolved) {
    const doc = (chapter.content ?? { type: 'doc', content: [] }) as PMNode
    const { doc: stripped, stripped: didStrip } = stripMarkById(
      doc,
      'hiveAnnotation',
      'annotationId',
      annotationId,
    )
    if (didStrip) {
      await db
        .update(chapters)
        .set({ content: stripped, updatedAt: new Date() })
        .where(eq(chapters.id, chapter.id))
    }
  }

  return { success: true, data: undefined }
}

export async function resolveAnnotationAction(annotationId: string): Promise<ActionResult> {
  return setAnnotationResolved(annotationId, true)
}

export async function unresolveAnnotationAction(annotationId: string): Promise<ActionResult> {
  return setAnnotationResolved(annotationId, false)
}

// ── getChapterAnnotationsAction ──────────────────────────────────────────────

export async function getChapterAnnotationsAction(
  chapterId: string,
  hiveId: string,
): Promise<ActionResult<GetChapterAnnotationsData>> {
  const userId = await requireAuth()
  try {
    await requireHiveMember(hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { bookId: true },
  })
  if (!hive) return { success: false, error: 'NOT_FOUND' }
  const chapter = await db.query.chapters.findFirst({
    where: eq(chapters.id, chapterId),
    columns: { id: true, bookId: true, content: true },
  })
  if (!chapter || chapter.bookId !== hive.bookId) {
    return { success: false, error: 'NOT_FOUND' }
  }

  const rows = await db.query.hiveAnnotations.findMany({
    where: eq(hiveAnnotations.chapterId, chapterId),
    orderBy: [asc(hiveAnnotations.createdAt)],
  })

  const userIds = Array.from(
    new Set(
      rows
        .flatMap((r) => [r.authorId, r.resolvedBy])
        .filter((v): v is string => !!v),
    ),
  )
  const profiles = userIds.length
    ? await db.query.userProfiles.findMany({
        where: (t, { inArray }) => inArray(t.userId, userIds),
        columns: { userId: true, username: true, avatarUrl: true, displayName: true },
      })
    : []
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]))

  const annotations: AnnotationRow[] = rows.map((r) => {
    const author = profileByUserId.get(r.authorId)
    const resolver = r.resolvedBy ? profileByUserId.get(r.resolvedBy) : null
    return {
      id: r.id,
      hiveId: r.hiveId,
      chapterId: r.chapterId,
      authorId: r.authorId,
      parentId: r.parentId,
      layer: r.layer as AnnotationLayer,
      selectionStart: r.selectionStart,
      selectionEnd: r.selectionEnd,
      selectedText: r.selectedText,
      body: r.body,
      resolved: r.resolved,
      resolvedBy: r.resolvedBy,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      author: {
        userId: r.authorId,
        username: author?.username ?? null,
        avatarUrl: author?.avatarUrl ?? null,
        displayName: author?.displayName ?? null,
      },
      resolver: r.resolvedBy
        ? {
            userId: r.resolvedBy,
            username: resolver?.username ?? null,
            avatarUrl: resolver?.avatarUrl ?? null,
            displayName: resolver?.displayName ?? null,
          }
        : null,
    }
  })

  // Top-level annotation ids only (replies don't carry their own marks).
  const topLevelIds = rows.filter((r) => r.parentId === null).map((r) => r.id)
  const doc = (chapter.content ?? { type: 'doc', content: [] }) as PMNode
  const { orphanRows } = findOrphanMarks(doc, 'hiveAnnotation', 'annotationId', topLevelIds)

  return {
    success: true,
    data: { annotations, orphanRowIds: orphanRows },
  }
}

// ── getAnnotationsForHiveAction ──────────────────────────────────────────────

export type HiveAnnotationItem = {
  id: string
  author: {
    username: string | null
    avatarUrl: string | null
    displayName: string | null
  }
  layer: AnnotationLayer
  body: string
  selectedText: string | null
  resolved: boolean
  resolvedBy: string | null
  resolvedAt: Date | null
  createdAt: Date
  hasReplies: boolean
}

export type HiveAnnotationsByChapter = {
  chapterId: string
  chapterTitle: string
  annotations: HiveAnnotationItem[]
}

export type GetAnnotationsForHiveData = {
  byChapter: HiveAnnotationsByChapter[]
  totalCount: number
}

export type GetAnnotationsForHiveOptions = {
  layers?: AnnotationLayer[]
  includeResolved?: boolean
}

export async function getAnnotationsForHiveAction(
  hiveId: string,
  options: GetAnnotationsForHiveOptions = {},
): Promise<ActionResult<GetAnnotationsForHiveData>> {
  const userId = await requireAuth()
  try {
    await requireHiveMember(hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { bookId: true },
  })
  if (!hive) return { success: false, error: 'NOT_FOUND' }

  const includeResolved = options.includeResolved ?? false
  const layers = options.layers && options.layers.length > 0 ? options.layers : null

  const whereClauses = [
    eq(hiveAnnotations.hiveId, hiveId),
    isNull(hiveAnnotations.parentId),
  ]
  if (!includeResolved) whereClauses.push(eq(hiveAnnotations.resolved, false))
  if (layers) whereClauses.push(inArray(hiveAnnotations.layer, layers))

  const rows = await db
    .select({
      annotationId: hiveAnnotations.id,
      chapterId: hiveAnnotations.chapterId,
      layer: hiveAnnotations.layer,
      body: hiveAnnotations.body,
      selectedText: hiveAnnotations.selectedText,
      resolved: hiveAnnotations.resolved,
      resolvedBy: hiveAnnotations.resolvedBy,
      resolvedAt: hiveAnnotations.resolvedAt,
      authorId: hiveAnnotations.authorId,
      createdAt: hiveAnnotations.createdAt,
      chapterTitle: binderItems.title,
      chapterOrder: binderItems.order,
      authorUsername: userProfiles.username,
      authorAvatar: userProfiles.avatarUrl,
      authorDisplayName: userProfiles.displayName,
    })
    .from(hiveAnnotations)
    .innerJoin(chapters, eq(chapters.id, hiveAnnotations.chapterId))
    .leftJoin(binderItems, eq(binderItems.id, chapters.binderItemId))
    .leftJoin(userProfiles, eq(userProfiles.userId, hiveAnnotations.authorId))
    .where(and(...whereClauses))
    .orderBy(asc(binderItems.order), desc(hiveAnnotations.createdAt))

  if (rows.length === 0) {
    return { success: true, data: { byChapter: [], totalCount: 0 } }
  }

  const topLevelIds = rows.map((r) => r.annotationId)
  const replyRows = await db.query.hiveAnnotations.findMany({
    where: (t, { inArray: inArr }) => inArr(t.parentId, topLevelIds),
    columns: { parentId: true },
  })
  const parentsWithReplies = new Set(
    replyRows.map((r) => r.parentId).filter((v): v is string => !!v),
  )

  const byChapter = new Map<string, HiveAnnotationsByChapter>()
  for (const r of rows) {
    let group = byChapter.get(r.chapterId)
    if (!group) {
      group = {
        chapterId: r.chapterId,
        chapterTitle: r.chapterTitle ?? 'Untitled chapter',
        annotations: [],
      }
      byChapter.set(r.chapterId, group)
    }
    group.annotations.push({
      id: r.annotationId,
      author: {
        username: r.authorUsername,
        avatarUrl: r.authorAvatar,
        displayName: r.authorDisplayName,
      },
      layer: r.layer as AnnotationLayer,
      body: r.body,
      selectedText: r.selectedText,
      resolved: r.resolved,
      resolvedBy: r.resolvedBy,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
      hasReplies: parentsWithReplies.has(r.annotationId),
    })
  }

  return {
    success: true,
    data: {
      byChapter: Array.from(byChapter.values()),
      totalCount: rows.length,
    },
  }
}


// -----------------------------------------------------------------------------
// C5b T9 — Parent-id lookup action for MENTION notification deep links.
// -----------------------------------------------------------------------------

export async function getAnnotationParentsAction(
  annotationId: string,
): Promise<
  | { success: true; data: { hiveId: string; chapterId: string } }
  | { success: false; error: string }
> {
  await requireAuth()
  const row = await db.query.hiveAnnotations.findFirst({
    where: eq(hiveAnnotations.id, annotationId),
    columns: { hiveId: true, chapterId: true },
  })
  if (!row) return { success: false, error: 'NOT_FOUND' }
  return { success: true, data: { hiveId: row.hiveId, chapterId: row.chapterId } }
}
