'use server'

import { db } from '@/db'
import { bookLikes, bookmarks, books, follows, bookComments, notifications, userProfiles } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { canReadBook } from '@/lib/books/can-read'
import { z } from 'zod'
import { recordSocialActivityTx } from '@/lib/social/record-activity'
import { ensureLikedListAction } from '@/lib/reading-lists/ensure-liked-list'
import { extractMentionUsernamesFromText } from '@/lib/mentions/extract-mentions'
import { resolveMentionedUsers } from '@/lib/mentions/resolve-mentions'
import { recordMentionNotificationsTx } from '@/lib/mentions/record-mention-notifications'
import { shouldSkipNotification } from '@/lib/notifications/check-preferences'
import type { ActionResult } from './book.actions'
import type { BookComment } from './discover.actions'

export async function toggleBookLikeAction(bookId: string): Promise<ActionResult<{ liked: boolean }>> {
  const userId = await requireAuth()

  const existing = await db
    .select()
    .from(bookLikes)
    .where(and(eq(bookLikes.userId, userId), eq(bookLikes.bookId, bookId)))
    .limit(1)

  if (existing.length > 0) {
    await db
      .delete(bookLikes)
      .where(and(eq(bookLikes.userId, userId), eq(bookLikes.bookId, bookId)))
    return { success: true, data: { liked: false } }
  }

  await db.transaction(async (tx) => {
    await tx.insert(bookLikes).values({ userId, bookId })

    const [book] = await tx
      .select({ userId: books.userId, visibility: books.visibility, discoverable: books.discoverable })
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1)
    if (book && book.userId !== userId) {
      if (!(await shouldSkipNotification(book.userId, 'NEW_LIKE'))) {
        await tx.insert(notifications).values({
          userId: book.userId,
          type: 'NEW_LIKE',
          actorId: userId,
          resourceType: 'book',
          resourceId: bookId,
        })
      }
    }

    // C1 T8 hook: book_liked. Fire only on LIKE (insert path). Gate on PUBLIC+discoverable.
    // Per-6h dedupe is automatic via T3's DEDUPE_ELIGIBLE set.
    if (book && book.visibility === 'PUBLIC' && book.discoverable === true) {
      await recordSocialActivityTx(tx, {
        actorId: userId,
        type: 'book_liked',
        subjectType: 'book',
        subjectId: bookId,
        payload: { bookOwnerId: book.userId },
      })
    }
  })

  // C3 T8: lazy-create the user's Liked auto-list on first like. Best-effort
  // outside the tx — failure must never block the like (mirrors C1 record-
  // activity precedent). Idempotent via the partial-unique index on
  // reading_lists(user_id) WHERE kind='LIKED'.
  await ensureLikedListAction(userId)

  return { success: true, data: { liked: true } }
}

export async function toggleBookmarkAction(bookId: string): Promise<ActionResult<{ bookmarked: boolean }>> {
  const userId = await requireAuth()

  const existing = await db
    .select()
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.bookId, bookId)))
    .limit(1)

  if (existing.length > 0) {
    await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.bookId, bookId)))
    return { success: true, data: { bookmarked: false } }
  }

  await db.insert(bookmarks).values({ userId, bookId })
  return { success: true, data: { bookmarked: true } }
}

export async function toggleFollowAction(targetUserId: string): Promise<ActionResult<{ following: boolean }>> {
  const userId = await requireAuth()

  if (userId === targetUserId) return { success: false, error: 'CANNOT_FOLLOW_SELF' }

  const existing = await db
    .select()
    .from(follows)
    .where(and(eq(follows.followerId, userId), eq(follows.followeeId, targetUserId)))
    .limit(1)

  if (existing.length > 0) {
    await db
      .delete(follows)
      .where(and(eq(follows.followerId, userId), eq(follows.followeeId, targetUserId)))
    return { success: true, data: { following: false } }
  }

  await db.insert(follows).values({ followerId: userId, followeeId: targetUserId })

  if (!(await shouldSkipNotification(targetUserId, 'NEW_FOLLOWER'))) {
    await db.insert(notifications).values({
      userId: targetUserId,
      type: 'NEW_FOLLOWER',
      actorId: userId,
      resourceType: 'user',
      resourceId: userId,
    })
  }

  return { success: true, data: { following: true } }
}

const addCommentSchema = z.object({
  content: z.string().min(1).max(1000),
})

export async function addCommentAction(
  bookId: string,
  content: string
): Promise<ActionResult<BookComment>> {
  const userId = await requireAuth()

  const access = await canReadBook(bookId, userId)
  if (!access.ok) return { success: false, error: 'FORBIDDEN' }

  const parsed = addCommentSchema.safeParse({ content })
  if (!parsed.success) return { success: false, error: 'INVALID_CONTENT' }

  // C5a T10: mention extraction + early cap check (text surface — book comments are plain textareas).
  const textUsernames = extractMentionUsernamesFromText(parsed.data.content)
  if (textUsernames.length > 5) return { success: false, error: 'MENTION_CAP_EXCEEDED' }

  let comment: typeof bookComments.$inferSelect
  try {
    comment = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(bookComments)
        .values({ bookId, userId, content: parsed.data.content })
        .returning()

      const [book] = await tx
        .select({ userId: books.userId, visibility: books.visibility, discoverable: books.discoverable })
        .from(books)
        .where(eq(books.id, bookId))
        .limit(1)
      if (book && book.userId !== userId) {
        if (!(await shouldSkipNotification(book.userId, 'NEW_COMMENT'))) {
          await tx.insert(notifications).values({
            userId: book.userId,
            type: 'NEW_COMMENT',
            actorId: userId,
            resourceType: 'book',
            resourceId: bookId,
          })
        }
      }

      // C1 T8 hook: book_commented. Gate on PUBLIC+discoverable. Spec §3.4.
      if (book && book.visibility === 'PUBLIC' && book.discoverable === true) {
        await recordSocialActivityTx(tx, {
          actorId: userId,
          type: 'book_commented',
          subjectType: 'comment',
          subjectId: created.id,
          payload: { bookId, excerpt: created.content.slice(0, 120) },
        })
      }

      // C5a T10: resolve + record mention notifications. resourceType
      // = 'book_comment' per spec §3.4. resourceId is the new comment id.
      // First-write CREATE: alreadyNotified will be empty since the row didn't
      // exist before this tx; the dedupe query is still cheap + correct.
      const mentionResult = await resolveMentionedUsers({
        tiptapUserIds: [],
        textUsernames,
        actorId: userId,
        resourceType: 'book_comment',
        resourceId: created.id,
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
          resourceType: 'book_comment',
          resourceId: created.id,
        })
      }

      return created
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'MENTION_CAP_EXCEEDED') {
      return { success: false, error: 'MENTION_CAP_EXCEEDED' }
    }
    throw e
  }

  const [profile] = await db
    .select({
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1)

  return {
    success: true,
    data: {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      authorUsername: profile?.username ?? null,
      authorDisplayName: profile?.displayName ?? null,
      authorAvatarUrl: profile?.avatarUrl ?? null,
    },
  }
}

export async function getUserSocialStateAction(
  bookId: string,
  authorUserId: string
): Promise<ActionResult<{ liked: boolean; bookmarked: boolean; following: boolean }>> {
  const userId = await requireAuth()

  const [liked, bookmarked, following] = await Promise.all([
    db.select().from(bookLikes).where(and(eq(bookLikes.userId, userId), eq(bookLikes.bookId, bookId))).limit(1),
    db.select().from(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.bookId, bookId))).limit(1),
    db.select().from(follows).where(and(eq(follows.followerId, userId), eq(follows.followeeId, authorUserId))).limit(1),
  ])

  return {
    success: true,
    data: {
      liked: liked.length > 0,
      bookmarked: bookmarked.length > 0,
      following: following.length > 0,
    },
  }
}
