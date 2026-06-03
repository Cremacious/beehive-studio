'use server'

import { db } from '@/db'
import {
  hiveSuggestions,
  hives,
  chapters,
  books,
  binderItems,
  chapterSnapshots,
  userProfiles,
} from '@/db/schema'
import { eq, and, asc, isNull } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import {
  requireHiveMember,
  canSuggestEdits,
  canReviewSuggestion,
} from '@/lib/hive/permissions'
import {
  recordHiveActivityTx,
  type DrizzleTx,
} from '@/lib/hive/record-activity'
import {
  createSuggestionSchema,
  replyToSuggestionSchema,
  rejectSuggestionSchema,
  type CreateSuggestionInput,
  type ReplyToSuggestionInput,
  type RejectSuggestionInput,
} from '@/lib/validations/hive-suggestion'
import { patchDocWithMark } from '@/lib/tiptap-extensions/patch-mark'
import { pmPosToTextOffset } from '@/lib/tiptap-extensions/pm-pos'
import { applySuggestionToDoc } from '@/lib/tiptap-extensions/apply-suggestion'
import { findOrphanMarks, type PMNode } from '@/lib/tiptap-extensions/mark-scanning'
import { getUserPremiumStatus } from '@/lib/premium'
import { extractWordCount } from '@/lib/tiptap-utils'
import { desc } from 'drizzle-orm'
import type { ActionResult } from './book.actions'

// ── Public types ─────────────────────────────────────────────────────────────

export type SuggestionRow = {
  id: string
  hiveId: string
  chapterId: string
  authorId: string
  parentId: string | null
  selectionStart: number | null
  selectionEnd: number | null
  originalExcerpt: string | null
  suggestedText: string | null
  body: string | null
  resolved: boolean
  resolvedBy: string | null
  resolvedAt: Date | null
  acceptedAt: Date | null
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

export type GetChapterSuggestionsData = {
  suggestions: SuggestionRow[]
  orphanRowIds: string[]
}

export type PendingSuggestionItem = {
  id: string
  authorUsername: string | null
  authorAvatar: string | null
  originalExcerpt: string
  suggestedText: string
  createdAt: Date
  hasReplies: boolean
}

export type PendingSuggestionsByChapter = {
  chapterId: string
  chapterTitle: string
  suggestions: PendingSuggestionItem[]
}

// ── createSuggestionAction ───────────────────────────────────────────────────

export async function createSuggestionAction(
  input: CreateSuggestionInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = createSuggestionSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const {
    hiveId,
    chapterId,
    selectionStart,
    selectionEnd,
    originalExcerpt,
    suggestedText,
    body,
  } = parsed.data

  let role
  try {
    role = await requireHiveMember(hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canSuggestEdits(role)) return { success: false, error: 'NOT_AUTHORIZED' }

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

  const result = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(hiveSuggestions)
      .values({
        hiveId,
        chapterId,
        authorId: userId,
        parentId: null,
        selectionStart,
        selectionEnd,
        originalExcerpt,
        suggestedText,
        body: body ?? null,
      })
      .returning({ id: hiveSuggestions.id })
    const newId = inserted.id

    // Patch chapter content with the suggestion mark.
    // selectionStart/End come from editor.state.selection (ProseMirror
    // positions); patchDocWithMark walks text offsets. Convert before passing —
    // same fix as createAnnotationAction. Without this, multi-paragraph docs
    // would have the mark fall in the wrong range or silently drop.
    const doc = (chapter.content ?? { type: 'doc', content: [] }) as PMNode
    const textStart = pmPosToTextOffset(doc, selectionStart)
    const textEnd = pmPosToTextOffset(doc, selectionEnd)
    const nextDoc = patchDocWithMark(
      doc,
      'hiveSuggestion',
      { suggestionId: newId },
      textStart,
      textEnd,
    )
    await tx
      .update(chapters)
      .set({ content: nextDoc, updatedAt: new Date() })
      .where(eq(chapters.id, chapterId))

    // Activity payload shape (top-level suggestion only — replies don't fire):
    //   { suggestionId, chapterId, originalExcerpt, suggestedText }
    await recordHiveActivityTx(tx as DrizzleTx, {
      hiveId,
      actorId: userId,
      type: 'suggestion_proposed',
      subjectId: newId,
      payload: {
        suggestionId: newId,
        chapterId,
        originalExcerpt,
        suggestedText,
      },
    })

    return newId
  })

  return { success: true, data: { id: result } }
}

// ── replyToSuggestionAction ──────────────────────────────────────────────────

export async function replyToSuggestionAction(
  input: ReplyToSuggestionInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = replyToSuggestionSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { parentId, body } = parsed.data

  const parent = await db.query.hiveSuggestions.findFirst({
    where: eq(hiveSuggestions.id, parentId),
    columns: {
      id: true,
      hiveId: true,
      chapterId: true,
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
  if (!canSuggestEdits(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  const [inserted] = await db
    .insert(hiveSuggestions)
    .values({
      hiveId: parent.hiveId,
      chapterId: parent.chapterId,
      authorId: userId,
      parentId: parent.id,
      // Reply rows: selection / excerpt / suggestedText carry no semantics
      // (DB columns are NOT NULL — use empty-string sentinels).
      selectionStart: 0,
      selectionEnd: 0,
      originalExcerpt: '',
      suggestedText: '',
      body,
    })
    .returning({ id: hiveSuggestions.id })

  // No activity event for replies.
  return { success: true, data: { id: inserted.id } }
}

// ── acceptSuggestionAction ───────────────────────────────────────────────────

export async function acceptSuggestionAction(
  suggestionId: string,
): Promise<ActionResult<{ acceptedAt: Date | null; newWordCount: number | null; orphan: boolean }>> {
  const userId = await requireAuth()

  const suggestion = await db.query.hiveSuggestions.findFirst({
    where: eq(hiveSuggestions.id, suggestionId),
    columns: {
      id: true,
      hiveId: true,
      chapterId: true,
      suggestedText: true,
      originalExcerpt: true,
      parentId: true,
      resolved: true,
    },
  })
  if (!suggestion) return { success: false, error: 'NOT_FOUND' }
  if (suggestion.parentId !== null) {
    return { success: false, error: 'CANNOT_ACCEPT_REPLY' }
  }

  const chapter = await db.query.chapters.findFirst({
    where: eq(chapters.id, suggestion.chapterId),
    columns: { id: true, bookId: true, content: true },
  })
  if (!chapter) return { success: false, error: 'NOT_FOUND' }

  const book = await db.query.books.findFirst({
    where: eq(books.id, chapter.bookId),
    columns: { id: true, userId: true },
  })
  if (!book) return { success: false, error: 'NOT_FOUND' }

  let role
  try {
    role = await requireHiveMember(suggestion.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canReviewSuggestion(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  const doc = (chapter.content ?? { type: 'doc', content: [] }) as PMNode
  const { doc: nextDoc, found } = applySuggestionToDoc(
    doc,
    suggestion.id,
    suggestion.suggestedText,
  )

  if (!found) {
    // Orphan path — mark resolved without touching the chapter.
    await db.transaction(async (tx) => {
      await tx
        .update(hiveSuggestions)
        .set({
          resolved: true,
          resolvedBy: userId,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(hiveSuggestions.id, suggestion.id))

      // Activity payload shape (orphan-on-accept path — emits suggestion_rejected
      // because the suggestion never landed; carries orphan: true sentinel so
      // /community renderers can distinguish from an explicit reject):
      //   { suggestionId, chapterId, note: null, orphan: true }
      await recordHiveActivityTx(tx as DrizzleTx, {
        hiveId: suggestion.hiveId,
        actorId: userId,
        type: 'suggestion_rejected',
        subjectId: suggestion.id,
        payload: {
          suggestionId: suggestion.id,
          chapterId: suggestion.chapterId,
          note: null,
          orphan: true,
        },
      })
    })

    return { success: true, data: { acceptedAt: null, newWordCount: null, orphan: true } }
  }

  // Happy path: apply doc + bump word count + bump book.updatedAt + resolve suggestion.
  const newWordCount = extractWordCount(nextDoc)
  const acceptedAt = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(chapters)
      .set({ content: nextDoc, wordCount: newWordCount, updatedAt: new Date() })
      .where(eq(chapters.id, suggestion.chapterId))

    await tx
      .update(books)
      .set({ updatedAt: new Date() })
      .where(eq(books.id, book.id))

    await tx
      .update(hiveSuggestions)
      .set({
        resolved: true,
        resolvedBy: userId,
        resolvedAt: acceptedAt,
        acceptedAt,
        updatedAt: acceptedAt,
      })
      .where(eq(hiveSuggestions.id, suggestion.id))

    // Activity payload shape (accept path):
    //   { suggestionId, chapterId }
    await recordHiveActivityTx(tx as DrizzleTx, {
      hiveId: suggestion.hiveId,
      actorId: userId,
      type: 'suggestion_accepted',
      subjectId: suggestion.id,
      payload: {
        suggestionId: suggestion.id,
        chapterId: suggestion.chapterId,
      },
    })
  })

  // Snapshot OUTSIDE the tx — mirror saveChapterAction. Gated on the BOOK
  // OWNER's premium status (snapshots belong to the chapter's owning book).
  // 60s throttle against the most recent snapshot.
  const isPremium = await getUserPremiumStatus(book.userId)
  if (isPremium) {
    const recent = await db.query.chapterSnapshots.findFirst({
      where: eq(chapterSnapshots.chapterId, suggestion.chapterId),
      orderBy: [desc(chapterSnapshots.createdAt)],
      columns: { createdAt: true },
    })

    const sixtySecondsAgo = new Date(Date.now() - 60_000)
    if (!recent || recent.createdAt < sixtySecondsAgo) {
      await db.insert(chapterSnapshots).values({
        chapterId: suggestion.chapterId,
        content: nextDoc,
        wordCount: newWordCount,
      })
    }
  }

  return { success: true, data: { acceptedAt, newWordCount, orphan: false } }
}

// ── rejectSuggestionAction ───────────────────────────────────────────────────

export async function rejectSuggestionAction(
  input: RejectSuggestionInput,
): Promise<ActionResult> {
  const userId = await requireAuth()
  const parsed = rejectSuggestionSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { id, note } = parsed.data

  const suggestion = await db.query.hiveSuggestions.findFirst({
    where: eq(hiveSuggestions.id, id),
    columns: {
      id: true,
      hiveId: true,
      chapterId: true,
      parentId: true,
      originalExcerpt: true,
    },
  })
  if (!suggestion) return { success: false, error: 'NOT_FOUND' }
  if (suggestion.parentId !== null) {
    return { success: false, error: 'CANNOT_REJECT_REPLY' }
  }

  let role
  try {
    role = await requireHiveMember(suggestion.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canReviewSuggestion(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(hiveSuggestions)
      .set({
        resolved: true,
        resolvedBy: userId,
        resolvedAt: now,
        // acceptedAt remains NULL
        updatedAt: now,
      })
      .where(eq(hiveSuggestions.id, id))

    // Activity payload shape (explicit reject path):
    //   { suggestionId, chapterId, note }
    await recordHiveActivityTx(tx as DrizzleTx, {
      hiveId: suggestion.hiveId,
      actorId: userId,
      type: 'suggestion_rejected',
      subjectId: id,
      payload: {
        suggestionId: id,
        chapterId: suggestion.chapterId,
        note: note ?? null,
      },
    })
  })

  return { success: true, data: undefined }
}

// ── getChapterSuggestionsAction ──────────────────────────────────────────────

export async function getChapterSuggestionsAction(
  args: { chapterId: string; hiveId: string },
): Promise<ActionResult<GetChapterSuggestionsData>> {
  const { chapterId, hiveId } = args
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

  const rows = await db.query.hiveSuggestions.findMany({
    where: eq(hiveSuggestions.chapterId, chapterId),
    orderBy: [asc(hiveSuggestions.createdAt)],
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

  const suggestions: SuggestionRow[] = rows.map((r) => {
    const author = profileByUserId.get(r.authorId)
    const resolver = r.resolvedBy ? profileByUserId.get(r.resolvedBy) : null
    return {
      id: r.id,
      hiveId: r.hiveId,
      chapterId: r.chapterId,
      authorId: r.authorId,
      parentId: r.parentId,
      selectionStart: r.parentId ? null : r.selectionStart,
      selectionEnd: r.parentId ? null : r.selectionEnd,
      originalExcerpt: r.parentId ? null : r.originalExcerpt,
      suggestedText: r.parentId ? null : r.suggestedText,
      body: r.body,
      resolved: r.resolved,
      resolvedBy: r.resolvedBy,
      resolvedAt: r.resolvedAt,
      acceptedAt: r.acceptedAt,
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

  // Top-level suggestion ids only (replies don't carry their own marks).
  const topLevelIds = rows.filter((r) => r.parentId === null).map((r) => r.id)
  const doc = (chapter.content ?? { type: 'doc', content: [] }) as PMNode
  const { orphanRows } = findOrphanMarks(doc, 'hiveSuggestion', 'suggestionId', topLevelIds)

  return {
    success: true,
    data: { suggestions, orphanRowIds: orphanRows },
  }
}

// ── getPendingSuggestionsForHiveAction ───────────────────────────────────────

export async function getPendingSuggestionsForHiveAction(
  hiveId: string,
): Promise<ActionResult<PendingSuggestionsByChapter[]>> {
  const userId = await requireAuth()
  try {
    await requireHiveMember(hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  // Pull all pending top-level suggestions for this hive, plus the joined
  // chapter / binder-item / author info needed to group + sort.
  const rows = await db
    .select({
      suggestionId: hiveSuggestions.id,
      chapterId: hiveSuggestions.chapterId,
      originalExcerpt: hiveSuggestions.originalExcerpt,
      suggestedText: hiveSuggestions.suggestedText,
      authorId: hiveSuggestions.authorId,
      createdAt: hiveSuggestions.createdAt,
      chapterTitle: binderItems.title,
      chapterOrder: binderItems.order,
      authorUsername: userProfiles.username,
      authorAvatar: userProfiles.avatarUrl,
    })
    .from(hiveSuggestions)
    .innerJoin(chapters, eq(chapters.id, hiveSuggestions.chapterId))
    .leftJoin(binderItems, eq(binderItems.id, chapters.binderItemId))
    .leftJoin(userProfiles, eq(userProfiles.userId, hiveSuggestions.authorId))
    .where(
      and(
        eq(hiveSuggestions.hiveId, hiveId),
        eq(hiveSuggestions.resolved, false),
        isNull(hiveSuggestions.parentId),
      ),
    )
    .orderBy(asc(binderItems.order), asc(hiveSuggestions.createdAt))

  if (rows.length === 0) {
    return { success: true, data: [] }
  }

  // Resolve hasReplies for each top-level suggestion via a single second query.
  const topLevelIds = rows.map((r) => r.suggestionId)
  const replyRows = topLevelIds.length
    ? await db.query.hiveSuggestions.findMany({
        where: (t, { inArray }) => inArray(t.parentId, topLevelIds),
        columns: { parentId: true },
      })
    : []
  const parentsWithReplies = new Set(
    replyRows.map((r) => r.parentId).filter((v): v is string => !!v),
  )

  // Group by chapter, preserving the first-encountered binderItems.order.
  const byChapter = new Map<string, PendingSuggestionsByChapter>()
  for (const r of rows) {
    let group = byChapter.get(r.chapterId)
    if (!group) {
      group = {
        chapterId: r.chapterId,
        chapterTitle: r.chapterTitle ?? 'Untitled chapter',
        suggestions: [],
      }
      byChapter.set(r.chapterId, group)
    }
    group.suggestions.push({
      id: r.suggestionId,
      authorUsername: r.authorUsername,
      authorAvatar: r.authorAvatar,
      originalExcerpt: r.originalExcerpt,
      suggestedText: r.suggestedText,
      createdAt: r.createdAt,
      hasReplies: parentsWithReplies.has(r.suggestionId),
    })
  }

  return { success: true, data: Array.from(byChapter.values()) }
}
