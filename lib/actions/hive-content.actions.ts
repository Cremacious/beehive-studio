'use server'

import { db } from '@/db'
import { hiveOutlines, hiveWikiPages, hiveDiscussionPosts, hiveTasks, notifications, hives, binderItems, userProfiles, chapters } from '@/db/schema'
import { eq, and, asc, inArray } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { assertHiveMember, assertHiveAdmin } from './_helpers'
import { createTaskSchema, updateTaskSchema } from '@/lib/validations/hive'
import { requireHiveMember, type HiveRole } from '@/lib/hive/permissions'
import { tipTapToPlain } from '@/lib/tiptap-utils'
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
        excerpt: tipTapToPlain(content.body, 120),
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

export async function getHiveOutlineView(hiveId: string): Promise<ActionResult<{
  bookId: string
  outline: BinderItemRow | null
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
    where: and(eq(binderItems.bookId, hive.bookId), eq(binderItems.type, 'outline')),
  })

  const chapterItems = await db.query.binderItems.findMany({
    where: and(eq(binderItems.bookId, hive.bookId), eq(binderItems.type, 'chapter')),
    columns: { id: true, title: true, order: true },
    orderBy: [asc(binderItems.order)],
  })

  return {
    success: true,
    data: {
      bookId: hive.bookId,
      outline: outline ? toBinderItemRow(outline) : null,
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

// ── Legacy CRUD (T10 deletes) ────────────────────────────────────────────────

// ── Outline ───────────────────────────────────────────────────────────────────

export async function getHiveOutlineAction(hiveId: string): Promise<ActionResult<{ content: string | null }>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  const outline = await db.query.hiveOutlines.findFirst({ where: eq(hiveOutlines.hiveId, hiveId) })
  return { success: true, data: { content: outline?.content ?? null } }
}

export async function saveHiveOutlineAction(hiveId: string, content: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  await db.insert(hiveOutlines)
    .values({ hiveId, content })
    .onConflictDoUpdate({ target: hiveOutlines.hiveId, set: { content, updatedAt: new Date() } })
  return { success: true, data: undefined }
}

// ── Wiki ──────────────────────────────────────────────────────────────────────

export type WikiPageSummary = { id: string; title: string; updatedAt: Date }
export type WikiPageFull = WikiPageSummary & { content: string | null; hiveId: string }

export async function getWikiPagesAction(hiveId: string): Promise<ActionResult<WikiPageSummary[]>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  const pages = await db.query.hiveWikiPages.findMany({
    where: eq(hiveWikiPages.hiveId, hiveId),
    columns: { id: true, title: true, updatedAt: true },
    orderBy: (t, { asc }) => [asc(t.title)],
  })
  return { success: true, data: pages }
}

export async function createWikiPageAction(hiveId: string, title: string): Promise<ActionResult<{ pageId: string }>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  const [page] = await db.insert(hiveWikiPages)
    .values({ hiveId, title, createdBy: userId })
    .returning({ id: hiveWikiPages.id })
  return { success: true, data: { pageId: page.id } }
}

export async function getWikiPageAction(pageId: string): Promise<ActionResult<WikiPageFull>> {
  const userId = await requireAuth()
  const page = await db.query.hiveWikiPages.findFirst({ where: eq(hiveWikiPages.id, pageId) })
  if (!page) return { success: false, error: 'Page not found' }
  await assertHiveMember(page.hiveId, userId)
  return { success: true, data: page }
}

export async function saveWikiPageAction(pageId: string, content: string): Promise<ActionResult> {
  const userId = await requireAuth()
  const page = await db.query.hiveWikiPages.findFirst({ where: eq(hiveWikiPages.id, pageId), columns: { hiveId: true } })
  if (!page) return { success: false, error: 'Page not found' }
  await assertHiveMember(page.hiveId, userId)
  await db.update(hiveWikiPages).set({ content, updatedBy: userId, updatedAt: new Date() }).where(eq(hiveWikiPages.id, pageId))
  return { success: true, data: undefined }
}

export async function deleteWikiPageAction(pageId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  const page = await db.query.hiveWikiPages.findFirst({ where: eq(hiveWikiPages.id, pageId), columns: { hiveId: true } })
  if (!page) return { success: false, error: 'Page not found' }
  await assertHiveMember(page.hiveId, userId)
  await db.delete(hiveWikiPages).where(eq(hiveWikiPages.id, pageId))
  return { success: true, data: undefined }
}

// ── Discussion ────────────────────────────────────────────────────────────────

export type DiscussionPost = {
  id: string
  hiveId: string
  authorId: string
  content: string
  parentId: string | null
  createdAt: Date
  author: { name: string | null; image: string | null }
}

export async function getDiscussionPostsAction(hiveId: string): Promise<ActionResult<DiscussionPost[]>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  const posts = await db.query.hiveDiscussionPosts.findMany({
    where: eq(hiveDiscussionPosts.hiveId, hiveId),
    with: { author: { columns: { name: true, image: true } } },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })
  return { success: true, data: posts as DiscussionPost[] }
}

export async function createDiscussionPostAction(hiveId: string, content: string, parentId?: string): Promise<ActionResult<{ postId: string }>> {
  const userId = await requireAuth()
  await assertHiveMember(hiveId, userId)
  if (!content.trim()) return { success: false, error: 'Content required' }
  const [post] = await db.insert(hiveDiscussionPosts)
    .values({ hiveId, authorId: userId, content: content.trim(), parentId: parentId ?? null })
    .returning({ id: hiveDiscussionPosts.id })
  return { success: true, data: { postId: post.id } }
}

export async function deleteDiscussionPostAction(postId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  const post = await db.query.hiveDiscussionPosts.findFirst({ where: eq(hiveDiscussionPosts.id, postId) })
  if (!post) return { success: false, error: 'Post not found' }
  await assertHiveMember(post.hiveId, userId)
  if (post.authorId !== userId) await assertHiveAdmin(post.hiveId, userId)
  await db.delete(hiveDiscussionPosts).where(eq(hiveDiscussionPosts.id, postId))
  return { success: true, data: undefined }
}

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
