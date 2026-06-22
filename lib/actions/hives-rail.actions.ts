'use server'

import { db } from '@/db'
import { requireAuth } from '@/lib/require-auth'
import { hiveMembers } from '@/db/schema/hive'
import { and, eq, sql } from 'drizzle-orm'
import { computeTrendingScore } from '@/lib/discover/scoring'

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
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

const CANDIDATE_LIMIT = 60

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
 * Issue #32: Top discoverable PUBLIC hives ranked by time-decayed engagement.
 * activityCount (cumulative all-time hive_activity rows) feeds `likeCount`;
 * memberCount feeds `bookmarkCount` so larger hives get a small bonus.
 * hoursAgo from hives.created_at. Sorted by score DESC.
 * TODO(#32): wrap in unstable_cache (5min TTL, key on limit).
 */
export async function getTrendingHivesForRailAction(
  args: { limit?: number } = {},
): Promise<ActionResult<RailTrendingHive[]>> {
  const limit = Math.min(args.limit ?? 12, 30)

  try {
    const rows = await db.execute(sql`
      SELECT
        h.id,
        h.name,
        h.created_at AS "createdAt",
        b.title AS "bookTitle",
        b.cover_url AS "bookCoverUrl",
        COALESCE(mc.member_count, 0) AS "memberCount",
        COALESCE(ac.activity_count, 0) AS "activityCount",
        COALESCE((
          SELECT json_agg(json_build_object('userId', sub.user_id, 'avatarUrl', sub.avatar_url))
          FROM (
            SELECT hm2.user_id, up2.avatar_url
            FROM hive_members hm2
            LEFT JOIN user_profiles up2 ON up2.user_id = hm2.user_id
            WHERE hm2.hive_id = h.id
            ORDER BY hm2.joined_at DESC
            LIMIT 4
          ) sub
        ), '[]'::json) AS "memberPreviews"
      FROM hives h
      LEFT JOIN books b ON b.id = h.book_id
      LEFT JOIN (
        SELECT hive_id, COUNT(*)::int AS activity_count
        FROM hive_activity
        GROUP BY hive_id
      ) ac ON ac.hive_id = h.id
      LEFT JOIN (
        SELECT hive_id, COUNT(*)::int AS member_count
        FROM hive_members
        GROUP BY hive_id
      ) mc ON mc.hive_id = h.id
      WHERE h.visibility = 'PUBLIC' AND h.discoverable = true
      LIMIT ${CANDIDATE_LIMIT}
    `)

    type RawRow = {
      id: string
      name: string
      createdAt: Date | string
      bookTitle: string | null
      bookCoverUrl: string | null
      memberCount: number
      activityCount: number
      memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
    }

    const now = Date.now()
    const scored = (rows.rows as RawRow[]).map((r) => {
      const created =
        r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)
      const hoursAgo = Math.max(0, (now - created.getTime()) / 3_600_000)
      const score = computeTrendingScore({
        likeCount: Number(r.activityCount),
        commentCount: 0,
        bookmarkCount: Number(r.memberCount),
        hoursAgo,
      })
      return { row: r, score }
    })
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.row.id.localeCompare(a.row.id)
    })

    return {
      success: true,
      data: scored.slice(0, limit).map(({ row: r }) => ({
        id: r.id,
        name: r.name,
        bookTitle: r.bookTitle,
        bookCoverUrl: r.bookCoverUrl,
        memberCount: Number(r.memberCount),
        activity7d: Number(r.activityCount),
        memberPreviews: r.memberPreviews,
      })),
    }
  } catch {
    return { success: false, error: 'FETCH_FAILED' }
  }
}
