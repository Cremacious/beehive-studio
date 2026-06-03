'use server'

import { db } from '@/db'
import { hiveTasks, notifications, hives, binderItems, userProfiles, chapters, books, hiveAnnotations, hiveSuggestions } from '@/db/schema'
import { eq, and, asc, inArray, count, isNull } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { assertHiveMember, assertHiveAdmin } from './_helpers'
import { createTaskSchema, updateTaskSchema } from '@/lib/validations/hive'
import { requireHiveMember, type HiveRole } from '@/lib/hive/permissions'
import { extractWikiExcerpt } from '@/lib/wiki/excerpt'
import type { WikiCategory } from '@/lib/wiki/category-templates'
import type { BinderItemRow } from './binder.actions'
import type { ChapterStatus } from '@/lib/books/is-chapter-reader-visible'
import type { ActionResult } from './book.actions'

// ── H2 T9: Hive content views (binder-backed) ─────────────────────────────────

export type HiveWikiEntry = {
  id: string
  title: string
  category: WikiCategory
  tags: string[]
  excerpt: string
  authorId: string | null
  authorUsername: string | null
  authorAvatarUrl: string | null
  lastEditedBy: string | null
  lastEditedAt: Date
  parentId: string | null
}

export type HiveWikiFolder = {
  id: string
  title: string
  description: string | null
  parentId: string | null
  entryCount: number
}

export type HiveWikiViewData = {
  bookId: string
  entries: HiveWikiEntry[]
  folders: HiveWikiFolder[]
  viewerRole: HiveRole
  authorUserId: string
}

function toBinderItemRow(
  item: typeof binderItems.$inferSelect,
  chapterId: string | null = null,
  chapterStatus: ChapterStatus | null = null,
): BinderItemRow {
  return {
    id: item.id,
    bookId: item.bookId,
    parentId: item.parentId,
    type: item.type,
    title: item.title,
    order: item.order,
    content: item.content,
    authorId: item.authorId,
    lastEditedBy: item.lastEditedBy,
    chapterId,
    chapterStatus,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

export async function getHiveWikiView(hiveId: string): Promise<ActionResult<HiveWikiViewData>> {
  const userId = await requireAuth()
  const role = await requireHiveMember(hiveId, userId)
  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { bookId: true },
    with: { book: { columns: { userId: true } } },
  })
  if (!hive || !hive.bookId || !hive.book) return { success: false, error: 'HIVE_NOT_FOUND' }

  const items = await db.query.binderItems.findMany({
    where: and(
      eq(binderItems.bookId, hive.bookId),
      inArray(binderItems.type, ['wiki_entry', 'wiki_folder', 'character', 'research_folder']),
    ),
    orderBy: [asc(binderItems.order)],
  })

  const authorIds = Array.from(
    new Set(items.flatMap(i => [i.authorId, i.lastEditedBy]).filter((v): v is string => !!v)),
  )
  const profiles = authorIds.length
    ? await db.query.userProfiles.findMany({
        where: inArray(userProfiles.userId, authorIds),
        columns: { userId: true, username: true, avatarUrl: true },
      })
    : []
  const profileByUserId = new Map(profiles.map(p => [p.userId, p]))

  const entries: HiveWikiEntry[] = items
    .filter(i => i.type === 'wiki_entry' || i.type === 'character')
    .map(i => {
      const content = (i.content ?? {}) as { category?: WikiCategory; body?: unknown; tags?: string[] }
      const profile = i.authorId ? profileByUserId.get(i.authorId) : null
      return {
        id: i.id,
        title: i.title,
        category: i.type === 'character' ? 'CHARACTER' : (content.category ?? 'OTHER'),
        tags: Array.isArray(content.tags) ? content.tags : [],
        excerpt: extractWikiExcerpt(i.content, 120),
        authorId: i.authorId,
        authorUsername: profile?.username ?? null,
        authorAvatarUrl: profile?.avatarUrl ?? null,
        lastEditedBy: i.lastEditedBy,
        lastEditedAt: i.updatedAt,
        parentId: i.parentId,
      }
    })

  const folders: HiveWikiFolder[] = items
    .filter(i => i.type === 'wiki_folder' || i.type === 'research_folder')
    .map(i => {
      const c = (i.content ?? {}) as { description?: string }
      return {
        id: i.id,
        title: i.title,
        description: c.description ?? null,
        parentId: i.parentId,
        entryCount: entries.filter(e => e.parentId === i.id).length,
      }
    })

  return {
    success: true,
    data: {
      bookId: hive.bookId,
      entries,
      folders,
      viewerRole: role,
      authorUserId: hive.book.userId,
    },
  }
}

export type HiveOutlineEntry = {
  outline: BinderItemRow
  lastEditedByUsername: string | null
  lastEditedAt: Date | null
}

export async function getHiveOutlineView(hiveId: string): Promise<ActionResult<{
  bookId: string
  outlines: HiveOutlineEntry[]
  chapters: Array<{ id: string; title: string; order: number }>
  viewerRole: HiveRole
}>> {
  const userId = await requireAuth()
  const role = await requireHiveMember(hiveId, userId)
  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { bookId: true },
  })
  if (!hive || !hive.bookId) return { success: false, error: 'HIVE_NOT_FOUND' }

  const outlineItems = await db.query.binderItems.findMany({
    where: and(eq(binderItems.bookId, hive.bookId), eq(binderItems.type, 'outline')),
    orderBy: [asc(binderItems.order)],
  })

  const chapterItems = await db.query.binderItems.findMany({
    where: and(eq(binderItems.bookId, hive.bookId), eq(binderItems.type, 'chapter')),
    columns: { id: true, title: true, order: true },
    orderBy: [asc(binderItems.order)],
  })

  const editorIds = Array.from(
    new Set(outlineItems.map(o => o.lastEditedBy).filter((v): v is string => !!v)),
  )
  const editorProfiles = editorIds.length
    ? await db.query.userProfiles.findMany({
        where: inArray(userProfiles.userId, editorIds),
        columns: { userId: true, username: true },
      })
    : []
  const usernameByUserId = new Map(editorProfiles.map(p => [p.userId, p.username]))

  const outlines: HiveOutlineEntry[] = outlineItems.map(o => ({
    outline: toBinderItemRow(o),
    lastEditedByUsername: o.lastEditedBy ? (usernameByUserId.get(o.lastEditedBy) ?? null) : null,
    lastEditedAt: o.updatedAt ?? null,
  }))

  return {
    success: true,
    data: {
      bookId: hive.bookId,
      outlines,
      chapters: chapterItems,
      viewerRole: role,
    },
  }
}

export async function getHiveOutlineByIdAction(
  hiveId: string,
  outlineId: string,
): Promise<ActionResult<{
  entry: HiveOutlineEntry
  chapters: Array<{ id: string; title: string; order: number }>
  viewerRole: HiveRole
}>> {
  const userId = await requireAuth()
  const role = await requireHiveMember(hiveId, userId)
  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { bookId: true },
  })
  if (!hive || !hive.bookId) return { success: false, error: 'HIVE_NOT_FOUND' }

  const outline = await db.query.binderItems.findFirst({
    where: and(
      eq(binderItems.id, outlineId),
      eq(binderItems.bookId, hive.bookId),
      eq(binderItems.type, 'outline'),
    ),
  })
  if (!outline) return { success: false, error: 'OUTLINE_NOT_FOUND' }

  const chapterItems = await db.query.binderItems.findMany({
    where: and(eq(binderItems.bookId, hive.bookId), eq(binderItems.type, 'chapter')),
    columns: { id: true, title: true, order: true },
    orderBy: [asc(binderItems.order)],
  })

  let lastEditedByUsername: string | null = null
  if (outline.lastEditedBy) {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, outline.lastEditedBy),
      columns: { username: true },
    })
    lastEditedByUsername = profile?.username ?? null
  }

  return {
    success: true,
    data: {
      entry: {
        outline: toBinderItemRow(outline),
        lastEditedByUsername,
        lastEditedAt: outline.updatedAt ?? null,
      },
      chapters: chapterItems,
      viewerRole: role,
    },
  }
}

export async function getHiveNotesView(hiveId: string): Promise<ActionResult<{
  bookId: string
  notes: Array<BinderItemRow & { authorUsername: string | null }>
  viewerRole: HiveRole
}>> {
  const userId = await requireAuth()
  const role = await requireHiveMember(hiveId, userId)
  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { bookId: true },
  })
  if (!hive || !hive.bookId) return { success: false, error: 'HIVE_NOT_FOUND' }

  const items = await db.query.binderItems.findMany({
    where: and(eq(binderItems.bookId, hive.bookId), eq(binderItems.type, 'research_note')),
    orderBy: [asc(binderItems.order)],
  })

  const authorIds = Array.from(new Set(items.map(i => i.authorId).filter((v): v is string => !!v)))
  const profiles = authorIds.length
    ? await db.query.userProfiles.findMany({
        where: inArray(userProfiles.userId, authorIds),
        columns: { userId: true, username: true },
      })
    : []
  const usernameByUserId = new Map(profiles.map(p => [p.userId, p.username]))

  const notes = items.map(i => ({
    ...toBinderItemRow(i),
    authorUsername: i.authorId ? (usernameByUserId.get(i.authorId) ?? null) : null,
  }))

  return {
    success: true,
    data: {
      bookId: hive.bookId,
      notes,
      viewerRole: role,
    },
  }
}

export async function getBinderTreeForHiveAction(
  bookId: string,
  hiveId: string,
): Promise<ActionResult<BinderItemRow[]>> {
  const userId = await requireAuth()
  await requireHiveMember(hiveId, userId)

  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { bookId: true },
  })
  if (!hive || hive.bookId !== bookId) return { success: false, error: 'HIVE_NOT_FOUND' }

  const items = await db.query.binderItems.findMany({
    where: eq(binderItems.bookId, bookId),
    orderBy: [asc(binderItems.order)],
  })

  const chapterRows = await db.query.chapters.findMany({
    where: eq(chapters.bookId, bookId),
    columns: { id: true, binderItemId: true, status: true },
  })
  const chapterByBinderId = new Map(
    chapterRows.map(c => [c.binderItemId, { id: c.id, status: c.status as ChapterStatus }]),
  )

  const rows: BinderItemRow[] = items.map(item => {
    const ch =
      item.type === 'chapter' || item.type === 'front_matter' || item.type === 'back_matter'
        ? (chapterByBinderId.get(item.id) ?? null)
        : null
    return toBinderItemRow(item, ch?.id ?? null, ch?.status ?? null)
  })

  return { success: true, data: rows }
}

// ── H3 T16: Hive chapter list (for submission target-order picker) ──────────

export async function getHiveChapterListAction(
  hiveId: string,
): Promise<ActionResult<{
  bookId: string
  chapters: Array<{
    id: string
    chapterId: string | null
    title: string
    order: number
    annotationCount: number
    pendingSuggestionCount: number
  }>
}>> {
  const userId = await requireAuth()
  await requireHiveMember(hiveId, userId)
  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { bookId: true },
  })
  if (!hive || !hive.bookId) return { success: false, error: 'HIVE_NOT_FOUND' }

  // `id` is the binderItems PK (kept for submission target-order callers).
  // `chapterId` is the chapters PK, joined via chapters.binderItemId — that's
  // what /hive/[hiveId]/chapters/[chapterId] (T13) expects in its URL.
  const rows = await db
    .select({
      id: binderItems.id,
      chapterId: chapters.id,
      title: binderItems.title,
      order: binderItems.order,
      parentId: binderItems.parentId,
    })
    .from(binderItems)
    .leftJoin(chapters, eq(chapters.binderItemId, binderItems.id))
    .where(and(eq(binderItems.bookId, hive.bookId), eq(binderItems.type, 'chapter')))
    .orderBy(asc(binderItems.order))

  const topLevelRows = rows.filter(r => r.parentId === null)
  const chapterIds = topLevelRows
    .map(r => r.chapterId)
    .filter((id): id is string => id !== null)

  const annCounts = chapterIds.length === 0
    ? []
    : await db
        .select({
          chapterId: hiveAnnotations.chapterId,
          c: count(),
        })
        .from(hiveAnnotations)
        .where(and(
          inArray(hiveAnnotations.chapterId, chapterIds),
          isNull(hiveAnnotations.parentId),
        ))
        .groupBy(hiveAnnotations.chapterId)

  const sugCounts = chapterIds.length === 0
    ? []
    : await db
        .select({
          chapterId: hiveSuggestions.chapterId,
          c: count(),
        })
        .from(hiveSuggestions)
        .where(and(
          inArray(hiveSuggestions.chapterId, chapterIds),
          eq(hiveSuggestions.resolved, false),
          isNull(hiveSuggestions.parentId),
        ))
        .groupBy(hiveSuggestions.chapterId)

  const annByChapter = new Map(annCounts.map(r => [r.chapterId, Number(r.c)]))
  const sugByChapter = new Map(sugCounts.map(r => [r.chapterId, Number(r.c)]))

  const topLevel = topLevelRows.map(({ id, chapterId, title, order }) => ({
    id,
    chapterId,
    title,
    order,
    annotationCount: chapterId ? (annByChapter.get(chapterId) ?? 0) : 0,
    pendingSuggestionCount: chapterId ? (sugByChapter.get(chapterId) ?? 0) : 0,
  }))

  return { success: true, data: { bookId: hive.bookId, chapters: topLevel } }
}

// ── H3 T13: Hive chapter view ────────────────────────────────────────────────

export type HiveChapterViewData = {
  chapter: {
    id: string
    title: string
    content: unknown
    authorUserId: string | null
  }
  status: ChapterStatus
  synopsis: string | null
  scenePlanner: {
    goal: string | null
    conflict: string | null
    outcome: string | null
  }
  book: {
    id: string
    userId: string
    title: string
    ownerUsername: string | null
  }
  author: {
    userId: string
    username: string | null
    avatarUrl: string | null
  } | null
  hive: {
    id: string
    name: string
    bookId: string
  }
  viewerRole: HiveRole
}

function safeString(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length === 0 ? null : t
}

export async function getHiveChapterView(
  hiveId: string,
  chapterId: string,
): Promise<ActionResult<HiveChapterViewData>> {
  const userId = await requireAuth()
  const viewerRole = await requireHiveMember(hiveId, userId)

  const hive = await db.query.hives.findFirst({
    where: eq(hives.id, hiveId),
    columns: { id: true, name: true, bookId: true },
  })
  if (!hive || !hive.bookId) return { success: false, error: 'HIVE_NOT_FOUND' }

  const chapter = await db.query.chapters.findFirst({
    where: eq(chapters.id, chapterId),
    columns: {
      id: true,
      bookId: true,
      binderItemId: true,
      content: true,
      authorUserId: true,
      status: true,
    },
  })
  if (!chapter) return { success: false, error: 'NOT_FOUND' }
  // Cross-hive escape guard.
  if (chapter.bookId !== hive.bookId) return { success: false, error: 'NOT_FOUND' }

  // Title + synopsis + scene planner live on binder_items.content, not chapters.
  let title = 'Untitled Chapter'
  let rawContent: Record<string, unknown> = {}
  if (chapter.binderItemId) {
    const bi = await db.query.binderItems.findFirst({
      where: eq(binderItems.id, chapter.binderItemId),
      columns: { title: true, content: true },
    })
    if (bi?.title) title = bi.title
    if (bi?.content && typeof bi.content === 'object') {
      rawContent = bi.content as Record<string, unknown>
    }
  }
  const synopsis = safeString(rawContent.synopsis)
  const scenePlanner = {
    goal: safeString(rawContent.sceneGoal),
    conflict: safeString(rawContent.sceneConflict),
    outcome: safeString(rawContent.sceneOutcome),
  }

  const book = await db.query.books.findFirst({
    where: eq(books.id, chapter.bookId),
    columns: { id: true, userId: true, title: true },
  })
  if (!book) return { success: false, error: 'NOT_FOUND' }

  // Author profile (book owner + chapter submitter, if distinct).
  const profileIds = Array.from(
    new Set([book.userId, chapter.authorUserId].filter((v): v is string => !!v)),
  )
  const profiles = profileIds.length
    ? await db.query.userProfiles.findMany({
        where: inArray(userProfiles.userId, profileIds),
        columns: { userId: true, username: true, avatarUrl: true },
      })
    : []
  const profileByUserId = new Map(profiles.map(p => [p.userId, p]))
  const ownerProfile = profileByUserId.get(book.userId) ?? null
  const authorProfile =
    chapter.authorUserId && chapter.authorUserId !== book.userId
      ? (profileByUserId.get(chapter.authorUserId) ?? {
          userId: chapter.authorUserId,
          username: null,
          avatarUrl: null,
        })
      : null

  return {
    success: true,
    data: {
      chapter: {
        id: chapter.id,
        title,
        content: chapter.content,
        authorUserId: chapter.authorUserId,
      },
      status: chapter.status as ChapterStatus,
      synopsis,
      scenePlanner,
      book: {
        id: book.id,
        userId: book.userId,
        title: book.title,
        ownerUsername: ownerProfile?.username ?? null,
      },
      author: authorProfile
        ? {
            userId: authorProfile.userId,
            username: authorProfile.username ?? null,
            avatarUrl: authorProfile.avatarUrl ?? null,
          }
        : null,
      hive: { id: hive.id, name: hive.name, bookId: hive.bookId },
      viewerRole,
    },
  }
}

// ── Legacy CRUD (T10 deletes) ────────────────────────────────────────────────

// ── Tasks ─────────────────────────────────────────────────────────────────────

export type TaskRow = {
  id: string
  hiveId: string
  title: string
  description: string | null
  assigneeId: string | null
  creatorId: string
  status: string
  createdAt: Date
  assignee: { name: string | null; image: string | null } | null
}

export async function getTasksAction(hiveId: string): Promise<ActionResult<TaskRow[]>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  const tasks = await db.query.hiveTasks.findMany({
    where: eq(hiveTasks.hiveId, hiveId),
    with: { assignee: { columns: { name: true, image: true } } },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  })
  return { success: true, data: tasks as TaskRow[] }
}

export async function createTaskAction(hiveId: string, input: {
  title: string
  description?: string
  assigneeId?: string
}): Promise<ActionResult<{ taskId: string }>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  const parsed = createTaskSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const [task] = await db.insert(hiveTasks)
    .values({ hiveId, creatorId: userId, ...parsed.data })
    .returning({ id: hiveTasks.id })

  if (parsed.data.assigneeId && parsed.data.assigneeId !== userId) {
    await db.insert(notifications).values({
      userId: parsed.data.assigneeId,
      type: 'TASK_ASSIGNED',
      actorId: userId,
      resourceType: 'hive_task',
      resourceId: task.id,
    })
  }

  return { success: true, data: { taskId: task.id } }
}

export async function updateTaskAction(taskId: string, input: {
  title?: string
  description?: string | null
  assigneeId?: string | null
  status?: 'OPEN' | 'IN_PROGRESS' | 'DONE'
}): Promise<ActionResult> {
  const userId = await requireAuth()
  const task = await db.query.hiveTasks.findFirst({ where: eq(hiveTasks.id, taskId) })
  if (!task) return { success: false, error: 'Task not found' }
  await assertHiveMember(task.hiveId, userId)

  const parsed = updateTaskSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const { status, ...rest } = parsed.data
  await db.update(hiveTasks)
    .set({ ...rest, ...(status ? { status: status as 'OPEN' | 'IN_PROGRESS' | 'DONE' } : {}), updatedAt: new Date() })
    .where(eq(hiveTasks.id, taskId))

  if (parsed.data.status === 'DONE' && task.creatorId !== userId) {
    await db.insert(notifications).values({
      userId: task.creatorId,
      type: 'TASK_COMPLETED',
      actorId: userId,
      resourceType: 'hive_task',
      resourceId: taskId,
    })
  }

  return { success: true, data: undefined }
}

export async function deleteTaskAction(taskId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  const task = await db.query.hiveTasks.findFirst({ where: eq(hiveTasks.id, taskId) })
  if (!task) return { success: false, error: 'Task not found' }
  if (task.creatorId !== userId) await assertHiveAdmin(task.hiveId, userId)
  await db.delete(hiveTasks).where(eq(hiveTasks.id, taskId))
  return { success: true, data: undefined }
}
