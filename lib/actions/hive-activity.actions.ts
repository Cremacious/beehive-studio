'use server'

// Schema notes:
// - userProfiles holds the display-facing `username` + `avatarUrl` (the auth
//   `users` table has `name` + `image` but those are auth-internal). We
//   left-join userProfiles so feed events still render for users without a
//   profile row (username/avatar fall back to null).

import { db } from '@/db'
import { hiveActivity, hiveMembers, hives, userProfiles } from '@/db/schema'
import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import type { ActionResult } from './book.actions'

export type HiveActivityEvent = {
  id: string
  hiveId: string
  hiveName: string
  actorId: string
  actorUsername: string | null
  actorAvatarUrl: string | null
  type: string
  subjectId: string | null
  payload: unknown
  createdAt: Date
}

export type HiveActivityPage = {
  items: HiveActivityEvent[]
  nextCursor: string | null
}

/**
 * Member-scoped activity feed. Cursor = `<createdAt-ISO>|<id>` for stable order.
 * If `hiveId` is provided, scopes to a single hive (used by the H5 dashboard).
 */
export async function getHiveActivityFeedAction(
  opts: {
    cursor?: string | null
    limit?: number
    hiveId?: string | null
  } = {}
): Promise<ActionResult<HiveActivityPage>> {
  try {
    const userId = await requireAuth()
    const limit = Math.min(opts.limit ?? 30, 100)

    const memberHives = await db
      .select({ hiveId: hiveMembers.hiveId })
      .from(hiveMembers)
      .where(eq(hiveMembers.userId, userId))
    let hiveIds = memberHives.map((r) => r.hiveId)
    if (opts.hiveId) hiveIds = hiveIds.filter((id) => id === opts.hiveId)
    if (hiveIds.length === 0) return { success: true, data: { items: [], nextCursor: null } }

    let cursorDate: Date | null = null
    if (opts.cursor) {
      const [iso] = opts.cursor.split('|')
      cursorDate = new Date(iso)
    }

    const rows = await db
      .select({
        id: hiveActivity.id,
        hiveId: hiveActivity.hiveId,
        hiveName: hives.name,
        actorId: hiveActivity.actorId,
        actorUsername: userProfiles.username,
        actorAvatarUrl: userProfiles.avatarUrl,
        type: hiveActivity.type,
        subjectId: hiveActivity.subjectId,
        payload: hiveActivity.payload,
        createdAt: hiveActivity.createdAt,
      })
      .from(hiveActivity)
      .innerJoin(hives, eq(hives.id, hiveActivity.hiveId))
      .leftJoin(userProfiles, eq(userProfiles.userId, hiveActivity.actorId))
      .where(
        and(
          inArray(hiveActivity.hiveId, hiveIds),
          cursorDate ? lt(hiveActivity.createdAt, cursorDate) : undefined
        )
      )
      .orderBy(desc(hiveActivity.createdAt))
      .limit(limit + 1)

    const hasMore = rows.length > limit
    const items: HiveActivityEvent[] = rows.slice(0, limit).map((r) => ({
      id: r.id,
      hiveId: r.hiveId,
      hiveName: r.hiveName,
      actorId: r.actorId,
      actorUsername: r.actorUsername,
      actorAvatarUrl: r.actorAvatarUrl,
      type: r.type as string,
      subjectId: r.subjectId,
      payload: r.payload,
      createdAt: r.createdAt,
    }))
    const last = items[items.length - 1]
    const nextCursor = hasMore && last ? `${last.createdAt.toISOString()}|${last.id}` : null

    return { success: true, data: { items, nextCursor } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
