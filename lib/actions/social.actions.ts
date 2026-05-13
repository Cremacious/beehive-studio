'use server'

import { db } from '@/db'
import { bookLikes, bookmarks, follows, bookComments, userProfiles } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { z } from 'zod'
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

  await db.insert(bookLikes).values({ userId, bookId })
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

  const parsed = addCommentSchema.safeParse({ content })
  if (!parsed.success) return { success: false, error: 'INVALID_CONTENT' }

  const [comment] = await db
    .insert(bookComments)
    .values({ bookId, userId, content: parsed.data.content })
    .returning()

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
