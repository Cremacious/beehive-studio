'use server'

import { db } from '@/db'
import { hiveDiscussionPosts, userProfiles } from '@/db/schema'
import { eq, and, isNull, inArray, asc, desc } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { requireAuth } from '@/lib/require-auth'
import {
  requireHiveMember,
  canPostDiscussion,
  canEditDiscussionPost,
  type HiveRole,
} from '@/lib/hive/permissions'
import { recordHiveActivityTx, type DrizzleTx } from '@/lib/hive/record-activity'
import { extractMentionUsernamesFromText } from '@/lib/mentions/extract-mentions'
import { resolveMentionedUsers } from '@/lib/mentions/resolve-mentions'
import { recordMentionNotificationsTx } from '@/lib/mentions/record-mention-notifications'
import {
  createDiscussionPostSchema,
  replyToDiscussionPostSchema,
  editDiscussionPostSchema,
  listDiscussionPostsSchema,
  type CreateDiscussionPostInput,
  type ReplyToDiscussionPostInput,
  type EditDiscussionPostInput,
  type ListDiscussionPostsInput,
  type DiscussionTopic,
} from '@/lib/validations/hive-discussion'
import type { ActionResult } from './book.actions'

// ── Public types ────────────────────────────────────────────────────────────

export type DiscussionPostSummary = {
  id: string
  authorId: string
  username: string | null
  avatarUrl: string | null
  topic: DiscussionTopic
  title: string
  bodyExcerpt: string
  createdAt: Date
  replyCount: number
  lastActivityAt: Date
}

export type DiscussionPostRow = {
  id: string
  hiveId: string
  authorId: string
  username: string | null
  avatarUrl: string | null
  topic: DiscussionTopic | null
  body: string
  parentId: string | null
  createdAt: Date
}

export type DiscussionThreadData = {
  post: DiscussionPostRow
  replies: DiscussionPostRow[]
}

// Derive a stable, slice-truncated title from body for display.
function deriveTitle(body: string): string {
  return body.slice(0, 80)
}

// ── createDiscussionPostAction ──────────────────────────────────────────────

export async function createDiscussionPostAction(
  input: CreateDiscussionPostInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = createDiscussionPostSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { hiveId, topic, body } = parsed.data

  let role: HiveRole
  try {
    role = await requireHiveMember(hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canPostDiscussion(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  const id = createId()
  const title = deriveTitle(body)

  // Mention extraction + early cap check (before tx)
  const textUsernames = extractMentionUsernamesFromText(body)
  if (textUsernames.length > 5) {
    return { success: false, error: 'MENTION_CAP_EXCEEDED' }
  }

  await db.transaction(async (tx) => {
    await tx.insert(hiveDiscussionPosts).values({
      id,
      hiveId,
      authorId: userId,
      content: body,
      parentId: null,
      topic,
    })

    // Activity payload shape (top-level post only — replies don't fire):
    //   { postId, topic, title }
    await recordHiveActivityTx(tx as DrizzleTx, {
      hiveId,
      actorId: userId,
      type: 'discussion_posted',
      subjectId: id,
      payload: { postId: id, topic, title },
    })

    // Mention notifications
    if (textUsernames.length > 0) {
      const mentionResult = await resolveMentionedUsers({
        tiptapUserIds: [],
        textUsernames,
        actorId: userId,
        resourceType: 'hive_discussion',
        resourceId: id,
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
          resourceType: 'hive_discussion',
          resourceId: id,
        })
      }
    }
  })

  return { success: true, data: { id } }
}

// ── replyToDiscussionPostAction ─────────────────────────────────────────────

export async function replyToDiscussionPostAction(
  input: ReplyToDiscussionPostInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = replyToDiscussionPostSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { parentId, body } = parsed.data

  const parent = await db.query.hiveDiscussionPosts.findFirst({
    where: eq(hiveDiscussionPosts.id, parentId),
    columns: { id: true, hiveId: true, parentId: true },
  })
  if (!parent) return { success: false, error: 'NOT_FOUND' }

  // One level of depth only.
  if (parent.parentId !== null) {
    return { success: false, error: 'REPLY_DEPTH_EXCEEDED' }
  }

  let role: HiveRole
  try {
    role = await requireHiveMember(parent.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canPostDiscussion(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  const id = createId()

  // Mention extraction + early cap check (before tx)
  const textUsernames = extractMentionUsernamesFromText(body)
  if (textUsernames.length > 5) {
    return { success: false, error: 'MENTION_CAP_EXCEEDED' }
  }

  await db.transaction(async (tx) => {
    await tx.insert(hiveDiscussionPosts).values({
      id,
      hiveId: parent.hiveId,
      authorId: userId,
      content: body,
      parentId: parent.id,
      topic: null,
    })

    // Mention notifications
    if (textUsernames.length > 0) {
      const mentionResult = await resolveMentionedUsers({
        tiptapUserIds: [],
        textUsernames,
        actorId: userId,
        resourceType: 'hive_discussion_reply',
        resourceId: id,
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
          resourceType: 'hive_discussion_reply',
          resourceId: id,
        })
      }
    }
  })

  return { success: true, data: { id } }
}

// ── editDiscussionPostAction ────────────────────────────────────────────────

export async function editDiscussionPostAction(
  input: EditDiscussionPostInput,
): Promise<ActionResult> {
  const userId = await requireAuth()
  const parsed = editDiscussionPostSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { postId, body } = parsed.data

  const post = await db.query.hiveDiscussionPosts.findFirst({
    where: eq(hiveDiscussionPosts.id, postId),
    columns: { id: true, hiveId: true, authorId: true },
  })
  if (!post) return { success: false, error: 'NOT_FOUND' }

  let role: HiveRole
  try {
    role = await requireHiveMember(post.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canEditDiscussionPost({ authorId: post.authorId }, role, userId)) {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  // Mention extraction + early cap check (before tx)
  const textUsernames = extractMentionUsernamesFromText(body)
  if (textUsernames.length > 5) {
    return { success: false, error: 'MENTION_CAP_EXCEEDED' }
  }

  // Determine whether this is a top-level post or a reply for the resourceType.
  const fullPost = await db.query.hiveDiscussionPosts.findFirst({
    where: eq(hiveDiscussionPosts.id, postId),
    columns: { parentId: true },
  })
  const resourceType: 'hive_discussion' | 'hive_discussion_reply' =
    fullPost?.parentId ? 'hive_discussion_reply' : 'hive_discussion'

  await db.transaction(async (tx) => {
    await tx
      .update(hiveDiscussionPosts)
      .set({ content: body })
      .where(eq(hiveDiscussionPosts.id, postId))

    // Mention notifications (edit-fire diff vs 24h dedupe window)
    if (textUsernames.length > 0) {
      const mentionResult = await resolveMentionedUsers({
        tiptapUserIds: [],
        textUsernames,
        actorId: userId,
        resourceType,
        resourceId: postId,
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
          resourceType,
          resourceId: postId,
        })
      }
    }
  })

  return { success: true, data: undefined }
}

// ── deleteDiscussionPostAction ──────────────────────────────────────────────

export async function deleteDiscussionPostAction(
  postId: string,
): Promise<ActionResult> {
  const userId = await requireAuth()

  const post = await db.query.hiveDiscussionPosts.findFirst({
    where: eq(hiveDiscussionPosts.id, postId),
    columns: { id: true, hiveId: true, authorId: true },
  })
  if (!post) return { success: false, error: 'NOT_FOUND' }

  let role: HiveRole
  try {
    role = await requireHiveMember(post.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canEditDiscussionPost({ authorId: post.authorId }, role, userId)) {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  // FK CASCADE handles replies.
  await db.delete(hiveDiscussionPosts).where(eq(hiveDiscussionPosts.id, postId))

  return { success: true, data: undefined }
}

// ── listDiscussionPostsAction ───────────────────────────────────────────────

/**
 * Returns top-level posts only, with reply-count + last-activity computed in JS
 * by fetching all replies for the matched top-level posts in a second query.
 * (Drizzle's correlated-subquery API is awkward enough that the two-query
 * approach is clearer and the result-set sizes here are bounded by hive size.)
 */
export async function listDiscussionPostsAction(
  input: ListDiscussionPostsInput,
): Promise<ActionResult<DiscussionPostSummary[]>> {
  const userId = await requireAuth()
  const parsed = listDiscussionPostsSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { hiveId, topics } = parsed.data

  try {
    await requireHiveMember(hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  const topLevelWhere =
    topics && topics.length > 0
      ? and(
          eq(hiveDiscussionPosts.hiveId, hiveId),
          isNull(hiveDiscussionPosts.parentId),
          inArray(hiveDiscussionPosts.topic, topics),
        )
      : and(
          eq(hiveDiscussionPosts.hiveId, hiveId),
          isNull(hiveDiscussionPosts.parentId),
        )

  const topPosts = await db.query.hiveDiscussionPosts.findMany({
    where: topLevelWhere,
    orderBy: [desc(hiveDiscussionPosts.createdAt)],
  })

  if (topPosts.length === 0) {
    return { success: true, data: [] }
  }

  const topIds = topPosts.map((p) => p.id)

  // Reply lookup: all rows whose parent_id is in topIds.
  const replies = await db.query.hiveDiscussionPosts.findMany({
    where: inArray(hiveDiscussionPosts.parentId, topIds),
    columns: { parentId: true, createdAt: true },
  })

  const replyCountByParent = new Map<string, number>()
  const lastReplyAtByParent = new Map<string, Date>()
  for (const r of replies) {
    if (!r.parentId) continue
    replyCountByParent.set(r.parentId, (replyCountByParent.get(r.parentId) ?? 0) + 1)
    const prev = lastReplyAtByParent.get(r.parentId)
    if (!prev || r.createdAt.getTime() > prev.getTime()) {
      lastReplyAtByParent.set(r.parentId, r.createdAt)
    }
  }

  // Author profiles
  const distinctAuthorIds = Array.from(new Set(topPosts.map((p) => p.authorId)))
  const profiles = distinctAuthorIds.length
    ? await db.query.userProfiles.findMany({
        where: inArray(userProfiles.userId, distinctAuthorIds),
        columns: { userId: true, username: true, avatarUrl: true },
      })
    : []
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]))

  const summaries: DiscussionPostSummary[] = topPosts.map((p) => {
    const prof = profileByUserId.get(p.authorId)
    const lastReplyAt = lastReplyAtByParent.get(p.id)
    const lastActivityAt =
      lastReplyAt && lastReplyAt.getTime() > p.createdAt.getTime()
        ? lastReplyAt
        : p.createdAt
    return {
      id: p.id,
      authorId: p.authorId,
      username: prof?.username ?? null,
      avatarUrl: prof?.avatarUrl ?? null,
      topic: (p.topic as DiscussionTopic),
      title: deriveTitle(p.content),
      bodyExcerpt: p.content.slice(0, 200),
      createdAt: p.createdAt,
      replyCount: replyCountByParent.get(p.id) ?? 0,
      lastActivityAt,
    }
  })

  // Sort by lastActivityAt DESC.
  summaries.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime())

  return { success: true, data: summaries }
}

// ── getDiscussionThreadAction ───────────────────────────────────────────────

export async function getDiscussionThreadAction(
  postId: string,
): Promise<ActionResult<DiscussionThreadData>> {
  const userId = await requireAuth()

  const post = await db.query.hiveDiscussionPosts.findFirst({
    where: eq(hiveDiscussionPosts.id, postId),
  })
  if (!post) return { success: false, error: 'NOT_FOUND' }

  if (post.parentId !== null) {
    return { success: false, error: 'NOT_TOP_LEVEL' }
  }

  try {
    await requireHiveMember(post.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  const replies = await db.query.hiveDiscussionPosts.findMany({
    where: eq(hiveDiscussionPosts.parentId, postId),
    orderBy: [asc(hiveDiscussionPosts.createdAt)],
  })

  // Resolve profiles for post + replies.
  const distinctAuthorIds = Array.from(
    new Set([post.authorId, ...replies.map((r) => r.authorId)]),
  )
  const profiles = await db.query.userProfiles.findMany({
    where: inArray(userProfiles.userId, distinctAuthorIds),
    columns: { userId: true, username: true, avatarUrl: true },
  })
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]))

  function toRow(r: NonNullable<typeof post>): DiscussionPostRow {
    const prof = profileByUserId.get(r.authorId)
    return {
      id: r.id,
      hiveId: r.hiveId,
      authorId: r.authorId,
      username: prof?.username ?? null,
      avatarUrl: prof?.avatarUrl ?? null,
      topic: (r.topic as DiscussionTopic | null),
      body: r.content,
      parentId: r.parentId,
      createdAt: r.createdAt,
    }
  }

  return {
    success: true,
    data: {
      post: toRow(post),
      replies: replies.map(toRow),
    },
  }
}

// -----------------------------------------------------------------------------
// C5b T9 — Parent-id lookup actions for MENTION notification deep links.
// -----------------------------------------------------------------------------

export async function getHiveDiscussionParentsAction(
  discussionId: string,
): Promise<
  | { success: true; data: { hiveId: string } }
  | { success: false; error: string }
> {
  await requireAuth()
  const row = await db.query.hiveDiscussionPosts.findFirst({
    where: eq(hiveDiscussionPosts.id, discussionId),
    columns: { hiveId: true, parentId: true },
  })
  if (!row || row.parentId !== null) return { success: false, error: 'NOT_FOUND' }
  return { success: true, data: { hiveId: row.hiveId } }
}

export async function getHiveReplyParentsAction(
  replyId: string,
): Promise<
  | { success: true; data: { discussionId: string; hiveId: string } }
  | { success: false; error: string }
> {
  await requireAuth()
  const reply = await db.query.hiveDiscussionPosts.findFirst({
    where: eq(hiveDiscussionPosts.id, replyId),
    columns: { hiveId: true, parentId: true },
  })
  if (!reply || reply.parentId === null) return { success: false, error: 'NOT_FOUND' }
  return {
    success: true,
    data: { discussionId: reply.parentId, hiveId: reply.hiveId },
  }
}
