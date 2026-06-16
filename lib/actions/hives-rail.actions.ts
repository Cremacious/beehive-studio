'use server'

import { db } from '@/db'
import { requireAuth } from '@/lib/require-auth'
import { hiveMembers } from '@/db/schema/hive'
import { and, eq, sql } from 'drizzle-orm'

export type ViewerHiveStats = {
  owned: number
  memberOf: number
  weeklyGoalPct: number
  activeGoals: number
}

export type RailTrendingHive = {
  id: string
  name: string
  bookTitle: string | null
  bookCoverUrl: string | null
  memberCount: number
  activity7d: number
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

const TRENDING_WINDOW_MS = 7 * 86_400_000

/**
 * Four counts for the viewer's "Your hive stats" rail panel.
 * weeklyGoalPct is hardcoded to 0 for v1 (spec defers the computation).
 */
export async function getViewerHiveStatsAction(): Promise<ActionResult<ViewerHiveStats>> {
  const viewerId = await requireAuth()

  try {
    const [ownedRows, memberRows, activeGoalsRows] = await Promise.all([
      db
        .select({ n: sql<number>`COUNT(*)::int` })
        .from(hiveMembers)
        .where(and(eq(hiveMembers.userId, viewerId), eq(hiveMembers.role, 'OWNER'))),
      db
        .select({ n: sql<number>`COUNT(*)::int` })
        .from(hiveMembers)
        .where(and(eq(hiveMembers.userId, viewerId), sql`${hiveMembers.role} != 'OWNER'`)),
      // Active goals across all the viewer's hives (joined via hive_members).
      db.execute(sql`
        SELECT COUNT(*)::int AS n
        FROM hive_word_goals g
        WHERE g.is_active = true
          AND g.hive_id IN (SELECT hive_id FROM hive_members WHERE user_id = ${viewerId})
      `),
    ])

    return {
      success: true,
      data: {
        owned: ownedRows[0]?.n ?? 0,
        memberOf: memberRows[0]?.n ?? 0,
        weeklyGoalPct: 0,
        activeGoals: (activeGoalsRows.rows[0] as { n?: number } | undefined)?.n ?? 0,
      },
    }
  } catch {
    return { success: false, error: 'FETCH_FAILED' }
  }
}

/**
 * Top discoverable PUBLIC hives ranked by 7-day activity count.
 * Used by the Hives Hub right rail.
 */
export async function getTrendingHivesForRailAction(
  args: { limit?: number } = {},
): Promise<ActionResult<RailTrendingHive[]>> {
  const limit = Math.min(args.limit ?? 3, 10)
  const windowStart = new Date(Date.now() - TRENDING_WINDOW_MS)

  try {
    const rows = await db.execute(sql`
      SELECT
        h.id,
        h.name,
        b.title AS "bookTitle",
        b.cover_url AS "bookCoverUrl",
        COALESCE(mc.member_count, 0) AS "memberCount",
        COALESCE(ac.activity_7d, 0) AS "activity7d"
      FROM hives h
      LEFT JOIN books b ON b.id = h.book_id
      LEFT JOIN (
        SELECT hive_id, COUNT(*)::int AS activity_7d
        FROM hive_activity
        WHERE created_at >= ${windowStart}
        GROUP BY hive_id
      ) ac ON ac.hive_id = h.id
      LEFT JOIN (
        SELECT hive_id, COUNT(*)::int AS member_count
        FROM hive_members
        GROUP BY hive_id
      ) mc ON mc.hive_id = h.id
      WHERE h.visibility = 'PUBLIC' AND h.discoverable = true
      ORDER BY COALESCE(ac.activity_7d, 0) DESC, h.created_at DESC
      LIMIT ${limit}
    `)

    type Row = {
      id: string
      name: string
      bookTitle: string | null
      bookCoverUrl: string | null
      memberCount: number
      activity7d: number
    }

    return {
      success: true,
      data: rows.rows.map((r) => r as Row),
    }
  } catch {
    return { success: false, error: 'FETCH_FAILED' }
  }
}
