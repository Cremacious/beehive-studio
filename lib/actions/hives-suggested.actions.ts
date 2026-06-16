'use server'

import { db } from '@/db'
import { requireAuth } from '@/lib/require-auth'
import { sql } from 'drizzle-orm'
import type { HiveSummary } from './hive.actions'

export type SuggestedHive = HiveSummary & {
  lastActiveAt: Date | null
  suggestionReason: string | null
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

const TRENDING_WINDOW_MS = 7 * 86_400_000

type RawTierRow = {
  id: string
  bookId: string | null
  name: string
  description: string | null
  visibility: 'PRIVATE' | 'PUBLIC' | 'FRIENDS'
  status: 'ACTIVE' | 'COMPLETED'
  ownerId: string
  createdAt: string | Date
  bookTitle: string | null
  bookCoverUrl: string | null
  memberCount: number
  lastActiveAt: string | Date | null
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
  friendCount?: number
  topFriendUsername?: string | null
  mutualCount?: number
  fofUsername?: string | null
}

function normalizeRow(row: RawTierRow, suggestionReason: string | null): SuggestedHive {
  return {
    id: row.id,
    bookId: row.bookId,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    status: row.status,
    ownerId: row.ownerId,
    memberCount: row.memberCount,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    bookTitle: row.bookTitle,
    bookCoverUrl: row.bookCoverUrl,
    memberPreviews: row.memberPreviews,
    lastActiveAt:
      row.lastActiveAt == null
        ? null
        : row.lastActiveAt instanceof Date
        ? row.lastActiveAt
        : new Date(row.lastActiveAt),
    suggestionReason,
  }
}

/**
 * 3-tier suggested hives ranking for the Hives Hub `Suggested` tab.
 *
 * Tier 1 — Hives where someone the viewer follows is a member.
 * Tier 2 — Hives where a friend-of-a-friend (mutual via a follow) is a member.
 * Tier 3 — Public+discoverable trending fallback (7-day activity).
 *
 * Tiers run sequentially: T1 first, then T2+T3 in parallel with the
 * accumulated exclusion list. After all three resolve we concat, dedupe by
 * `hive.id` (keeping the first occurrence — T1 wins), then slice to limit.
 *
 * All tiers exclude hives the viewer is already a member of and require
 * PUBLIC + discoverable. PRIVATE / FRIENDS hives never surface.
 */
export async function getSuggestedHivesAction(
  args: { limit?: number } = {},
): Promise<ActionResult<SuggestedHive[]>> {
  const viewerId = await requireAuth()
  const limit = args.limit ?? 100

  try {
    // ── Tier 1: Friend-members ──────────────────────────────────────────────
    const tier1Result = await db.execute(sql`
      SELECT
        h.id,
        h.book_id    AS "bookId",
        h.name,
        h.description,
        h.visibility,
        h.status,
        h.owner_id   AS "ownerId",
        h.created_at AS "createdAt",
        b.title      AS "bookTitle",
        b.cover_url  AS "bookCoverUrl",
        (SELECT COUNT(*)::int FROM hive_members WHERE hive_id = h.id) AS "memberCount",
        (SELECT MAX(created_at) FROM hive_activity WHERE hive_id = h.id) AS "lastActiveAt",
        COUNT(DISTINCT f.followee_id)::int AS "friendCount",
        (
          SELECT up.username
          FROM hive_members hm_t
          INNER JOIN follows f_t
            ON f_t.followee_id = hm_t.user_id
           AND f_t.follower_id = ${viewerId}
          LEFT JOIN user_profiles up ON up.user_id = hm_t.user_id
          WHERE hm_t.hive_id = h.id
          ORDER BY hm_t.joined_at DESC
          LIMIT 1
        ) AS "topFriendUsername",
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
      INNER JOIN hive_members hm ON hm.hive_id = h.id
      INNER JOIN follows f
        ON f.followee_id = hm.user_id
       AND f.follower_id = ${viewerId}
      LEFT JOIN books b ON b.id = h.book_id
      WHERE h.visibility = 'PUBLIC'
        AND h.discoverable = true
        AND h.id NOT IN (SELECT hive_id FROM hive_members WHERE user_id = ${viewerId})
      GROUP BY h.id, b.title, b.cover_url
      ORDER BY COUNT(DISTINCT f.followee_id) DESC, MAX(hm.joined_at) DESC
      LIMIT 30
    `)

    const tier1Rows = tier1Result.rows as RawTierRow[]
    const tier1Hives: SuggestedHive[] = tier1Rows.map((row) => {
      const friendCount = row.friendCount ?? 0
      const reason =
        friendCount >= 2
          ? `${friendCount} friends are members`
          : row.topFriendUsername
          ? `@${row.topFriendUsername} is a member`
          : null
      return normalizeRow(row, reason)
    })

    const tier1Ids = tier1Hives.map((h) => h.id)
    // SQL IN () is invalid with empty list — guard with a sentinel.
    const tier1IdsFragment =
      tier1Ids.length > 0
        ? sql.join(tier1Ids.map((id) => sql`${id}`), sql`, `)
        : sql`NULL`

    // ── Tier 2 + Tier 3 in parallel ─────────────────────────────────────────
    const windowStart = new Date(Date.now() - TRENDING_WINDOW_MS)

    const [tier2Result, tier3Result] = await Promise.all([
      // Tier 2 — Friend-of-friend.
      // Inner LIMIT keeps the double-self-join on `follows` from exploding on
      // viewers with large follow graphs.
      db.execute(sql`
        SELECT
          h.id,
          h.book_id    AS "bookId",
          h.name,
          h.description,
          h.visibility,
          h.status,
          h.owner_id   AS "ownerId",
          h.created_at AS "createdAt",
          b.title      AS "bookTitle",
          b.cover_url  AS "bookCoverUrl",
          (SELECT COUNT(*)::int FROM hive_members WHERE hive_id = h.id) AS "memberCount",
          (SELECT MAX(created_at) FROM hive_activity WHERE hive_id = h.id) AS "lastActiveAt",
          COUNT(DISTINCT f2.followee_id)::int AS "mutualCount",
          (
            SELECT up.username
            FROM hive_members hm_t
            INNER JOIN follows f1_t ON f1_t.followee_id = hm_t.user_id
            INNER JOIN follows f2_t
              ON f2_t.followee_id = f1_t.follower_id
             AND f2_t.follower_id = ${viewerId}
            LEFT JOIN user_profiles up ON up.user_id = f1_t.follower_id
            WHERE hm_t.hive_id = h.id
              AND f1_t.follower_id != ${viewerId}
              AND NOT EXISTS (
                SELECT 1 FROM follows fd
                WHERE fd.follower_id = ${viewerId}
                  AND fd.followee_id = hm_t.user_id
              )
            ORDER BY hm_t.joined_at DESC
            LIMIT 1
          ) AS "fofUsername",
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
        INNER JOIN hive_members hm ON hm.hive_id = h.id
        INNER JOIN follows f1
          ON f1.followee_id = hm.user_id
         AND f1.follower_id != ${viewerId}
        INNER JOIN follows f2
          ON f2.followee_id = f1.follower_id
         AND f2.follower_id = ${viewerId}
        LEFT JOIN books b ON b.id = h.book_id
        WHERE h.visibility = 'PUBLIC'
          AND h.discoverable = true
          AND h.id NOT IN (SELECT hive_id FROM hive_members WHERE user_id = ${viewerId})
          AND h.id NOT IN (${tier1IdsFragment})
          AND NOT EXISTS (
            SELECT 1 FROM follows fd
            WHERE fd.follower_id = ${viewerId}
              AND fd.followee_id = hm.user_id
          )
        GROUP BY h.id, b.title, b.cover_url
        ORDER BY COUNT(DISTINCT f2.followee_id) DESC, MAX(hm.joined_at) DESC
        LIMIT 30
      `),

      // Tier 3 — Trending fallback.
      db.execute(sql`
        SELECT
          h.id,
          h.book_id    AS "bookId",
          h.name,
          h.description,
          h.visibility,
          h.status,
          h.owner_id   AS "ownerId",
          h.created_at AS "createdAt",
          b.title      AS "bookTitle",
          b.cover_url  AS "bookCoverUrl",
          (SELECT COUNT(*)::int FROM hive_members WHERE hive_id = h.id) AS "memberCount",
          (SELECT MAX(created_at) FROM hive_activity WHERE hive_id = h.id) AS "lastActiveAt",
          COALESCE(ac.activity_7d, 0) AS "activity7d",
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
          SELECT hive_id, COUNT(*)::int AS activity_7d
          FROM hive_activity
          WHERE created_at >= ${windowStart}
          GROUP BY hive_id
        ) ac ON ac.hive_id = h.id
        WHERE h.visibility = 'PUBLIC'
          AND h.discoverable = true
          AND h.id NOT IN (SELECT hive_id FROM hive_members WHERE user_id = ${viewerId})
          AND h.id NOT IN (${tier1IdsFragment})
        ORDER BY COALESCE(ac.activity_7d, 0) DESC, h.created_at DESC
        LIMIT 30
      `),
    ])

    const tier2Hives: SuggestedHive[] = (tier2Result.rows as RawTierRow[]).map((row) => {
      const mutualCount = row.mutualCount ?? 0
      const reason = row.fofUsername
        ? `${mutualCount} mutuals via @${row.fofUsername}`
        : `${mutualCount} mutuals`
      return normalizeRow(row, reason)
    })

    const tier3Hives: SuggestedHive[] = (tier3Result.rows as RawTierRow[]).map((row) =>
      normalizeRow(row, null),
    )

    // Dedupe by id, keep first occurrence (T1 > T2 > T3).
    const seen = new Set<string>()
    const merged: SuggestedHive[] = []
    for (const h of [...tier1Hives, ...tier2Hives, ...tier3Hives]) {
      if (seen.has(h.id)) continue
      seen.add(h.id)
      merged.push(h)
      if (merged.length >= limit) break
    }

    return { success: true, data: merged }
  } catch {
    return { success: false, error: 'FETCH_FAILED' }
  }
}
