'use server'

import { db } from '@/db'
import { hiveBuzzPosts, hiveBuzzLikes, userProfiles } from '@/db/schema'
import { and, eq, desc, inArray, lt, or, sql } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { requireAuth } from '@/lib/require-auth'
import {
  requireHiveMember,
  canPostBuzz,
  canLikeBuzz,
  canEditBuzz,
  type HiveRole,
} from '@/lib/hive/permissions'
import { recordHiveActivityTx, type DrizzleTx } from '@/lib/hive/record-activity'
import { extractMentionUsernamesFromText } from '@/lib/mentions/extract-mentions'
import { resolveMentionedUsers } from '@/lib/mentions/resolve-mentions'
import { recordMentionNotificationsTx } from '@/lib/mentions/record-mention-notifications'
import {
  createBuzzPostSchema,
  updateBuzzPostSchema,
  listBuzzPostsSchema,
  toggleBuzzLikeSchema,
  type CreateBuzzPostInput,
  type UpdateBuzzPostInput,
  type ListBuzzPostsInput,
  type ToggleBuzzLikeInput,
  type BuzzPostType,
} from '@/lib/validations/hive-buzz'
import type { ActionResult } from './book.actions'

// ── Public types ────────────────────────────────────────────────────────────

export type BuzzPostSummary = {
  id: string
  hiveId: string
  authorId: string
  username: string | null
  avatarUrl: string | null
  type: BuzzPostType
  body: string
  linkUrl: string | null
  likeCount: number
  viewerLiked: boolean
  createdAt: Date
  updatedAt: Date
}

// ── createBuzzPostAction ─────────────────────────────────────────────────────

export async function createBuzzPostAction(
  input: CreateBuzzPostInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireAuth()
  const parsed = createBuzzPostSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const data = parsed.data

  let role: HiveRole
  try {
    role = await requireHiveMember(data.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canPostBuzz(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  const id = createId()
  const linkUrl = data.type === 'LINK' ? data.linkUrl : null

  // Mention extraction + early cap check (before tx)
  const textUsernames = extractMentionUsernamesFromText(data.body)
  if (textUsernames.length > 5) {
    return { success: false, error: 'MENTION_CAP_EXCEEDED' }
  }

  await db.transaction(async (tx) => {
    await tx.insert(hiveBuzzPosts).values({
      id,
      hiveId: data.hiveId,
      authorId: userId,
      type: data.type,
      body: data.body,
      linkUrl,
    })

    // Activity payload shape: { type: 'TEXT' | 'LINK', bodyExcerpt: string (<=100 chars), linkUrl: string | null }
    // Consumed by app/[locale]/(app)/community/_components/activity-event-row.tsx to render
    // "posted: '<excerpt>...'" for TEXT and "shared a link to <hostname>" for LINK.
    await recordHiveActivityTx(tx as DrizzleTx, {
      hiveId: data.hiveId,
      actorId: userId,
      type: 'buzz_posted',
      subjectId: id,
      payload: {
        type: data.type,
        bodyExcerpt: data.body.slice(0, 100),
        linkUrl,
      },
    })

    // Mention notifications
    if (textUsernames.length > 0) {
      const mentionResult = await resolveMentionedUsers({
        tiptapUserIds: [],
        textUsernames,
        actorId: userId,
        resourceType: 'hive_buzz_post',
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
          resourceType: 'hive_buzz_post',
          resourceId: id,
        })
      }
    }
  })

  return { success: true, data: { id } }
}

// ── updateBuzzPostAction ─────────────────────────────────────────────────────

export async function updateBuzzPostAction(
  input: UpdateBuzzPostInput,
): Promise<ActionResult> {
  const userId = await requireAuth()
  const parsed = updateBuzzPostSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { id, body, linkUrl } = parsed.data

  const post = await db.query.hiveBuzzPosts.findFirst({
    where: eq(hiveBuzzPosts.id, id),
    columns: { id: true, hiveId: true, authorId: true, type: true },
  })
  if (!post) return { success: false, error: 'NOT_FOUND' }

  let role: HiveRole
  try {
    role = await requireHiveMember(post.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canEditBuzz({ authorId: post.authorId }, role, userId)) {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  // Type is locked. linkUrl only meaningful for LINK posts; ignored for TEXT.
  const set: { body: string; updatedAt: Date; linkUrl?: string | null } = {
    body,
    updatedAt: new Date(),
  }
  if (post.type === 'LINK') {
    // For LINK posts, allow editing linkUrl. If caller omits, leave it. Null
    // is disallowed (LINK row requires link_url per CHECK constraint).
    if (linkUrl !== undefined && linkUrl !== null) {
      set.linkUrl = linkUrl
    }
  }

  // Mention extraction + early cap check (before tx)
  const textUsernames = extractMentionUsernamesFromText(body)
  if (textUsernames.length > 5) {
    return { success: false, error: 'MENTION_CAP_EXCEEDED' }
  }

  await db.transaction(async (tx) => {
    await tx.update(hiveBuzzPosts).set(set).where(eq(hiveBuzzPosts.id, id))

    // Mention notifications (edit-fire diff vs 24h dedupe window)
    if (textUsernames.length > 0) {
      const mentionResult = await resolveMentionedUsers({
        tiptapUserIds: [],
        textUsernames,
        actorId: userId,
        resourceType: 'hive_buzz_post',
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
          resourceType: 'hive_buzz_post',
          resourceId: id,
        })
      }
    }
  })

  return { success: true, data: undefined }
}

// ── deleteBuzzPostAction ─────────────────────────────────────────────────────

export async function deleteBuzzPostAction(id: string): Promise<ActionResult> {
  const userId = await requireAuth()

  const post = await db.query.hiveBuzzPosts.findFirst({
    where: eq(hiveBuzzPosts.id, id),
    columns: { id: true, hiveId: true, authorId: true },
  })
  if (!post) return { success: false, error: 'NOT_FOUND' }

  let role: HiveRole
  try {
    role = await requireHiveMember(post.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canEditBuzz({ authorId: post.authorId }, role, userId)) {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  await db.delete(hiveBuzzPosts).where(eq(hiveBuzzPosts.id, id))

  return { success: true, data: undefined }
}

// ── listBuzzPostsAction ──────────────────────────────────────────────────────

export async function listBuzzPostsAction(
  input: ListBuzzPostsInput,
): Promise<ActionResult<{ posts: BuzzPostSummary[]; nextCursor: { createdAt: Date; id: string } | null }>> {
  const userId = await requireAuth()
  const parsed = listBuzzPostsSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { hiveId, cursor, limit = 20 } = parsed.data

  try {
    await requireHiveMember(hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  // Cursor: (createdAt, id) DESC keyset pagination — fetch rows strictly older
  // than the cursor pair.
  const whereClause = cursor
    ? and(
        eq(hiveBuzzPosts.hiveId, hiveId),
        or(
          lt(hiveBuzzPosts.createdAt, cursor.createdAt),
          and(
            eq(hiveBuzzPosts.createdAt, cursor.createdAt),
            lt(hiveBuzzPosts.id, cursor.id),
          ),
        ),
      )
    : eq(hiveBuzzPosts.hiveId, hiveId)

  const rows = await db.query.hiveBuzzPosts.findMany({
    where: whereClause,
    orderBy: [desc(hiveBuzzPosts.createdAt), desc(hiveBuzzPosts.id)],
    limit: limit + 1,
  })

  const hasMore = rows.length > limit
  const sliced = hasMore ? rows.slice(0, limit) : rows
  const nextCursor =
    hasMore && sliced.length > 0
      ? { createdAt: sliced[sliced.length - 1].createdAt, id: sliced[sliced.length - 1].id }
      : null

  if (sliced.length === 0) {
    return { success: true, data: { posts: [], nextCursor: null } }
  }

  const ids = sliced.map((r) => r.id)
  const authorIds = Array.from(new Set(sliced.map((r) => r.authorId)))

  // viewer-liked rows for this page only.
  const likes = await db.query.hiveBuzzLikes.findMany({
    where: and(
      eq(hiveBuzzLikes.userId, userId),
      inArray(hiveBuzzLikes.buzzId, ids),
    ),
    columns: { buzzId: true },
  })
  const likedSet = new Set(likes.map((l) => l.buzzId))

  const profiles = await db.query.userProfiles.findMany({
    where: inArray(userProfiles.userId, authorIds),
    columns: { userId: true, username: true, avatarUrl: true },
  })
  const profByUserId = new Map(profiles.map((p) => [p.userId, p]))

  const posts: BuzzPostSummary[] = sliced.map((r) => {
    const p = profByUserId.get(r.authorId)
    return {
      id: r.id,
      hiveId: r.hiveId,
      authorId: r.authorId,
      username: p?.username ?? null,
      avatarUrl: p?.avatarUrl ?? null,
      type: r.type as BuzzPostType,
      body: r.body,
      linkUrl: r.linkUrl,
      likeCount: r.likeCount,
      viewerLiked: likedSet.has(r.id),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  })

  return { success: true, data: { posts, nextCursor } }
}

// ── toggleBuzzLikeAction ─────────────────────────────────────────────────────

export async function toggleBuzzLikeAction(
  input: ToggleBuzzLikeInput,
): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  const userId = await requireAuth()
  const parsed = toggleBuzzLikeSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { buzzId } = parsed.data

  const post = await db.query.hiveBuzzPosts.findFirst({
    where: eq(hiveBuzzPosts.id, buzzId),
    columns: { id: true, hiveId: true },
  })
  if (!post) return { success: false, error: 'NOT_FOUND' }

  let role: HiveRole
  try {
    role = await requireHiveMember(post.hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }
  if (!canLikeBuzz(role)) return { success: false, error: 'NOT_AUTHORIZED' }

  const result = await db.transaction(async (tx) => {
    const existing = await tx
      .select({ userId: hiveBuzzLikes.userId })
      .from(hiveBuzzLikes)
      .where(
        and(eq(hiveBuzzLikes.userId, userId), eq(hiveBuzzLikes.buzzId, buzzId)),
      )
      .limit(1)

    if (existing.length > 0) {
      await tx
        .delete(hiveBuzzLikes)
        .where(
          and(eq(hiveBuzzLikes.userId, userId), eq(hiveBuzzLikes.buzzId, buzzId)),
        )
      await tx
        .update(hiveBuzzPosts)
        .set({ likeCount: sql`${hiveBuzzPosts.likeCount} - 1` })
        .where(eq(hiveBuzzPosts.id, buzzId))
      return { liked: false }
    } else {
      await tx.insert(hiveBuzzLikes).values({ userId, buzzId })
      await tx
        .update(hiveBuzzPosts)
        .set({ likeCount: sql`${hiveBuzzPosts.likeCount} + 1` })
        .where(eq(hiveBuzzPosts.id, buzzId))
      return { liked: true }
    }
  })

  // Read back the fresh count.
  const fresh = await db.query.hiveBuzzPosts.findFirst({
    where: eq(hiveBuzzPosts.id, buzzId),
    columns: { likeCount: true },
  })
  const likeCount = fresh?.likeCount ?? 0

  return { success: true, data: { liked: result.liked, likeCount } }
}

// -----------------------------------------------------------------------------
// C5b T9 — Parent-id lookup action for MENTION notification deep links.
// -----------------------------------------------------------------------------

export async function getBuzzHiveIdAction(
  buzzId: string,
): Promise<
  | { success: true; data: { hiveId: string } }
  | { success: false; error: string }
> {
  await requireAuth()
  const row = await db.query.hiveBuzzPosts.findFirst({
    where: eq(hiveBuzzPosts.id, buzzId),
    columns: { hiveId: true },
  })
  if (!row) return { success: false, error: 'NOT_FOUND' }
  return { success: true, data: { hiveId: row.hiveId } }
}
