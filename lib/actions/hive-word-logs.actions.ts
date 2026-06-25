'use server'

import { db } from '@/db'
import {
  hiveWordLogs,
  userProfiles,
  chapters,
  binderItems,
} from '@/db/schema'
import { and, desc, eq, lt, or } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { requireHiveMember } from '@/lib/hive/permissions'
import { runAction } from './safe-action'
import type { ActionResult } from './book.actions'

export type RecentWordLogItem = {
  id: string
  user: {
    id: string
    username: string | null
    avatarUrl: string | null
  }
  chapterId: string
  chapterTitle: string | null
  wordsAdded: number
  loggedAt: Date
}

export type RecentWordLogsPage = {
  items: RecentWordLogItem[]
  nextCursor: string | null
}

export type GetRecentWordLogsInput = {
  hiveId: string
  cursor?: string | null
  limit?: number
}

/**
 * Cursor-paginated feed of recent word_logs for a hive.
 * Cursor encodes `${loggedAt.toISOString()}|${id}`; tuple comparison on
 * (logged_at, id) DESC for stable pagination across ties.
 */
export async function getRecentWordLogsAction(
  input: GetRecentWordLogsInput,
): Promise<ActionResult<RecentWordLogsPage>> {
  return runAction(async () => {
  const userId = await requireAuth()
  const { hiveId } = input
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100)

  try {
    await requireHiveMember(hiveId, userId)
  } catch {
    return { success: false, error: 'NOT_AUTHORIZED' }
  }

  let cursorDate: Date | null = null
  let cursorId: string | null = null
  if (input.cursor) {
    const sep = input.cursor.lastIndexOf('|')
    if (sep > 0) {
      const iso = input.cursor.slice(0, sep)
      const id = input.cursor.slice(sep + 1)
      const d = new Date(iso)
      if (!Number.isNaN(d.getTime()) && id) {
        cursorDate = d
        cursorId = id
      }
    }
  }

  const rows = await db
    .select({
      id: hiveWordLogs.id,
      chapterId: hiveWordLogs.chapterId,
      wordsAdded: hiveWordLogs.wordsAdded,
      loggedAt: hiveWordLogs.loggedAt,
      userId: hiveWordLogs.userId,
      username: userProfiles.username,
      avatarUrl: userProfiles.avatarUrl,
      chapterTitle: binderItems.title,
    })
    .from(hiveWordLogs)
    .leftJoin(userProfiles, eq(userProfiles.userId, hiveWordLogs.userId))
    .leftJoin(chapters, eq(chapters.id, hiveWordLogs.chapterId))
    .leftJoin(binderItems, eq(binderItems.id, chapters.binderItemId))
    .where(
      and(
        eq(hiveWordLogs.hiveId, hiveId),
        cursorDate && cursorId
          ? or(
              lt(hiveWordLogs.loggedAt, cursorDate),
              and(
                eq(hiveWordLogs.loggedAt, cursorDate),
                lt(hiveWordLogs.id, cursorId),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(hiveWordLogs.loggedAt), desc(hiveWordLogs.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const sliced = rows.slice(0, limit)
  const items: RecentWordLogItem[] = sliced.map((r) => ({
    id: r.id,
    user: {
      id: r.userId,
      username: r.username,
      avatarUrl: r.avatarUrl,
    },
    chapterId: r.chapterId,
    chapterTitle: r.chapterTitle,
    wordsAdded: r.wordsAdded,
    loggedAt: r.loggedAt,
  }))

  const last = items[items.length - 1]
  const nextCursor =
    hasMore && last ? `${last.loggedAt.toISOString()}|${last.id}` : null

  return { success: true, data: { items, nextCursor } }
  })
}
