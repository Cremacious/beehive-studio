'use server'

import { db } from '@/db'
import { hiveOutlines, hiveWikiPages, hiveDiscussionPosts, hiveTasks, notifications } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { assertHiveMember, assertHiveAdmin } from './_helpers'
import { createTaskSchema, updateTaskSchema } from '@/lib/validations/hive'
import type { ActionResult } from './book.actions'

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
