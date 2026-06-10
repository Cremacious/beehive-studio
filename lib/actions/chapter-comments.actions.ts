'use server'

import { db } from '@/db'
import { chapterComments, chapters, books, userProfiles, notifications } from '@/db/schema'
import { eq, and, desc, isNull, count } from 'drizzle-orm'
import { z } from 'zod'
import { requireAuth, getOptionalUserId } from '@/lib/require-auth'
import { canReadBook } from '@/lib/books/can-read'
import { isChapterReaderVisible } from '@/lib/books/is-chapter-reader-visible'
import { shouldSkipNotification } from '@/lib/notifications/check-preferences'
import { extractMentionUsernamesFromText } from '@/lib/mentions/extract-mentions'
import { resolveMentionedUsers } from '@/lib/mentions/resolve-mentions'
import { recordMentionNotificationsTx } from '@/lib/mentions/record-mention-notifications'
import type { ActionResult } from './book.actions'

export type ChapterComment = {
  id: string
  content: string
  createdAt: Date
  authorUsername: string | null
  authorDisplayName: string | null
  authorAvatarUrl: string | null
}

const COMMENTS_PAGE_SIZE = 20

/**
 * Resolve the chapter's parent book + its reader-visibility status. Used by
 * both the read and write actions to gate access (a chapter on a hidden
 * book, or a draft chapter on a public book, can't accept comments from
 * non-authors).
 */
async function getChapterContext(chapterId: string) {
  const [row] = await db
    .select({
      chapterId: chapters.id,
      status: chapters.status,
      bookId: chapters.bookId,
      bookOwnerId: books.userId,
    })
    .from(chapters)
    .innerJoin(books, eq(chapters.bookId, books.id))
    .where(eq(chapters.id, chapterId))
    .limit(1)
  return row ?? null
}

export async function getChapterCommentsAction(
  chapterId: string,
  page: number = 1,
): Promise<ActionResult<{ comments: ChapterComment[]; hasMore: boolean }>> {
  const userId = await getOptionalUserId()

  const ctx = await getChapterContext(chapterId)
  if (!ctx) return { success: false, error: 'NOT_FOUND' }

  // Reader-visibility gate: non-author viewers may only see comments on
  // chapters they could actually read.
  const isAuthor = userId === ctx.bookOwnerId
  if (!isAuthor && !isChapterReaderVisible(ctx.status)) {
    return { success: false, error: 'FORBIDDEN' }
  }

  const access = await canReadBook(ctx.bookId, userId)
  if (!access.ok) return { success: false, error: 'FORBIDDEN' }

  const offset = (page - 1) * COMMENTS_PAGE_SIZE

  const rows = await db
    .select({
      id: chapterComments.id,
      content: chapterComments.content,
      createdAt: chapterComments.createdAt,
      authorUsername: userProfiles.username,
      authorDisplayName: userProfiles.displayName,
      authorAvatarUrl: userProfiles.avatarUrl,
    })
    .from(chapterComments)
    .innerJoin(userProfiles, eq(chapterComments.userId, userProfiles.userId))
    .where(and(eq(chapterComments.chapterId, chapterId), isNull(chapterComments.parentId)))
    .orderBy(desc(chapterComments.createdAt))
    .limit(COMMENTS_PAGE_SIZE + 1)
    .offset(offset)

  const hasMore = rows.length > COMMENTS_PAGE_SIZE
  return {
    success: true,
    data: { comments: rows.slice(0, COMMENTS_PAGE_SIZE), hasMore },
  }
}

const addChapterCommentSchema = z.object({
  content: z.string().min(1).max(1000),
})

export async function addChapterCommentAction(
  chapterId: string,
  content: string,
): Promise<ActionResult<ChapterComment>> {
  const userId = await requireAuth()

  const ctx = await getChapterContext(chapterId)
  if (!ctx) return { success: false, error: 'NOT_FOUND' }

  const isAuthor = userId === ctx.bookOwnerId
  if (!isAuthor && !isChapterReaderVisible(ctx.status)) {
    return { success: false, error: 'FORBIDDEN' }
  }

  const access = await canReadBook(ctx.bookId, userId)
  if (!access.ok) return { success: false, error: 'FORBIDDEN' }

  const parsed = addChapterCommentSchema.safeParse({ content })
  if (!parsed.success) return { success: false, error: 'INVALID_CONTENT' }

  // Mention extraction + per-comment cap of 5 (matches book comments).
  const textUsernames = extractMentionUsernamesFromText(parsed.data.content)
  if (textUsernames.length > 5) return { success: false, error: 'MENTION_CAP_EXCEEDED' }

  let comment: typeof chapterComments.$inferSelect
  try {
    comment = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(chapterComments)
        .values({ chapterId, userId, content: parsed.data.content })
        .returning()

      // Notify the book owner (unless they're the commenter or have opted out).
      // Chapter comments deliberately DO NOT fire a social_activity event —
      // book-level comments cover the "this book has new discussion"
      // broadcast signal; chapter comments would flood feeds.
      if (ctx.bookOwnerId !== userId) {
        if (!(await shouldSkipNotification(ctx.bookOwnerId, 'NEW_COMMENT'))) {
          await tx.insert(notifications).values({
            userId: ctx.bookOwnerId,
            type: 'NEW_COMMENT',
            actorId: userId,
            resourceType: 'chapter',
            resourceId: chapterId,
          })
        }
      }

      // Mention notifications.
      const mentionResult = await resolveMentionedUsers({
        tiptapUserIds: [],
        textUsernames,
        actorId: userId,
        resourceType: 'chapter_comment',
        resourceId: created.id,
      })
      if (!mentionResult.ok) throw new Error(mentionResult.error)
      const toNotify = mentionResult.users
        .filter((u) => !mentionResult.alreadyNotified.has(u.userId))
        .map((u) => u.userId)
      if (toNotify.length > 0) {
        await recordMentionNotificationsTx(tx, {
          actorId: userId,
          mentionedUserIds: toNotify,
          resourceType: 'chapter_comment',
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

export async function getChapterCommentsCountAction(chapterId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(chapterComments)
    .where(and(eq(chapterComments.chapterId, chapterId), isNull(chapterComments.parentId)))
  return row?.total ?? 0
}
