'use server'

import { db } from '@/db'
import { requireAuth } from '@/lib/require-auth'
import { sql } from 'drizzle-orm'

type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

/**
 * Flat projection used by the 3-tier suggested-clubs query. Carries the fields
 * the Clubs Hub `Suggested` tab + V2 card need; downstream aggregator (T4)
 * maps to `CommunityClubRow`. Intentionally NOT extending `ClubSummary` —
 * that type has nested `owner`/`currentBook`/`viewerMembership` shapes that
 * are out-of-scope for a discovery row, and projecting them would bloat each
 * tier's SQL without consumer benefit (see Task 3 report for trade-off).
 */
export type SuggestedClub = {
  id: string
  name: string
  description: string | null
  coverImageUrl: string | null
  visibility: 'PRIVATE' | 'PUBLIC' | 'FRIENDS'
  openJoin: boolean
  memberCount: number
  currentBookId: string | null
  currentBookTitle: string | null
  lastActivityAt: Date | null
  createdAt: Date
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
  suggestionReason: string | null
}

type RawTierRow = {
  id: string
  name: string
  description: string | null
  coverImageUrl: string | null
  visibility: 'PRIVATE' | 'PUBLIC' | 'FRIENDS'
  openJoin: boolean
  memberCount: number
  currentBookId: string | null
  currentBookTitle: string | null
  lastActivityAt: string | Date | null
  createdAt: string | Date
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
  friendCount?: number
  topFriendUsername?: string | null
  mutualCount?: number
  fofUsername?: string | null
}

function normalizeRow(row: RawTierRow, suggestionReason: string | null): SuggestedClub {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    coverImageUrl: row.coverImageUrl,
    visibility: row.visibility,
    openJoin: row.openJoin,
    memberCount: row.memberCount,
    currentBookId: row.currentBookId,
    currentBookTitle: row.currentBookTitle,
    lastActivityAt:
      row.lastActivityAt == null
        ? null
        : row.lastActivityAt instanceof Date
        ? row.lastActivityAt
        : new Date(row.lastActivityAt),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    memberPreviews: row.memberPreviews,
    suggestionReason,
  }
}

/**
 * 3-tier suggested clubs ranking for the Clubs Hub `Suggested` tab.
 *
 * Tier 1 — Clubs where someone the viewer follows is a member.
 * Tier 2 — Clubs where a friend-of-a-friend (mutual via a follow) is a member.
 * Tier 3 — PUBLIC + discoverable trending fallback (sorted by last_activity_at).
 *
 * Tiers run sequentially: T1 first (need ids), then T2+T3 in parallel with
 * accumulated exclusions. After all three resolve we concat, dedupe by
 * `club.id` (first occurrence wins — T1 > T2 > T3), then slice to limit.
 *
 * All tiers exclude clubs the viewer is already in and require PUBLIC +
 * discoverable. PRIVATE / FRIENDS clubs never surface.
 *
 * FoF cost: Tier 2 double-self-joins `follows`. We cap at `LIMIT 30` and
 * mirror the hives precedent — if the viewer's follow graph is large the
 * GROUP BY + double-join can be expensive, but the 30-row cap bounds output
 * cost. Inner subquery for `fofUsername` also runs against a per-club tiny
 * member set, not the full join product.
 */
export async function getSuggestedClubsAction(
  args: { limit?: number } = {},
): Promise<ActionResult<SuggestedClub[]>> {
  const viewerId = await requireAuth()
  const limit = args.limit ?? 100

  try {
    // ── Tier 1: Friend-members ──────────────────────────────────────────────
    const tier1Result = await db.execute(sql`
      SELECT
        c.id,
        c.name,
        c.description,
        c.cover_image_url        AS "coverImageUrl",
        c.visibility,
        c.open_join              AS "openJoin",
        c.member_count           AS "memberCount",
        c.current_book_id        AS "currentBookId",
        (SELECT bcb.title FROM book_club_books bcb
           WHERE bcb.id = c.current_book_id LIMIT 1) AS "currentBookTitle",
        c.last_activity_at       AS "lastActivityAt",
        c.created_at             AS "createdAt",
        COUNT(DISTINCT f.followee_id)::int AS "friendCount",
        (
          SELECT up.username
          FROM book_club_members bcm_t
          INNER JOIN follows f_t
            ON f_t.followee_id = bcm_t.user_id
           AND f_t.follower_id = ${viewerId}
          LEFT JOIN user_profiles up ON up.user_id = bcm_t.user_id
          WHERE bcm_t.club_id = c.id
          ORDER BY bcm_t.joined_at DESC
          LIMIT 1
        ) AS "topFriendUsername",
        COALESCE((
          SELECT json_agg(json_build_object('userId', sub.user_id, 'avatarUrl', sub.avatar_url))
          FROM (
            SELECT bcm2.user_id, up2.avatar_url
            FROM book_club_members bcm2
            LEFT JOIN user_profiles up2 ON up2.user_id = bcm2.user_id
            WHERE bcm2.club_id = c.id
            ORDER BY bcm2.joined_at DESC
            LIMIT 4
          ) sub
        ), '[]'::json) AS "memberPreviews"
      FROM book_clubs c
      INNER JOIN book_club_members bcm ON bcm.club_id = c.id
      INNER JOIN follows f
        ON f.followee_id = bcm.user_id
       AND f.follower_id = ${viewerId}
      WHERE c.visibility = 'PUBLIC'
        AND c.discoverable = true
        AND c.id NOT IN (SELECT club_id FROM book_club_members WHERE user_id = ${viewerId})
      GROUP BY c.id
      ORDER BY COUNT(DISTINCT f.followee_id) DESC, MAX(bcm.joined_at) DESC
      LIMIT 30
    `)

    const tier1Rows = tier1Result.rows as RawTierRow[]
    const tier1Clubs: SuggestedClub[] = tier1Rows.map((row) => {
      const friendCount = row.friendCount ?? 0
      const reason =
        friendCount >= 2
          ? `${friendCount} friends are members`
          : row.topFriendUsername
          ? `@${row.topFriendUsername} is a member`
          : null
      return normalizeRow(row, reason)
    })

    const tier1Ids = tier1Clubs.map((c) => c.id)
    // SQL IN () is invalid with empty list — guard with a sentinel so
    // `c.id NOT IN (NULL)` is vacuously true (Postgres-valid).
    const tier1IdsFragment =
      tier1Ids.length > 0
        ? sql.join(tier1Ids.map((id) => sql`${id}`), sql`, `)
        : sql`NULL`

    // ── Tier 2 + Tier 3 in parallel ─────────────────────────────────────────
    const [tier2Result, tier3Result] = await Promise.all([
      // Tier 2 — Friend-of-friend.
      // Double-self-join on `follows`: f1 (some user follows the member) +
      // f2 (viewer follows f1.follower). Inner LIMIT keeps the join product
      // bounded on viewers with large follow graphs.
      db.execute(sql`
        SELECT
          c.id,
          c.name,
          c.description,
          c.cover_image_url        AS "coverImageUrl",
          c.visibility,
          c.open_join              AS "openJoin",
          c.member_count           AS "memberCount",
          c.current_book_id        AS "currentBookId",
          (SELECT bcb.title FROM book_club_books bcb
             WHERE bcb.id = c.current_book_id LIMIT 1) AS "currentBookTitle",
          c.last_activity_at       AS "lastActivityAt",
          c.created_at             AS "createdAt",
          COUNT(DISTINCT f2.followee_id)::int AS "mutualCount",
          (
            SELECT up.username
            FROM book_club_members bcm_t
            INNER JOIN follows f1_t ON f1_t.followee_id = bcm_t.user_id
            INNER JOIN follows f2_t
              ON f2_t.followee_id = f1_t.follower_id
             AND f2_t.follower_id = ${viewerId}
            LEFT JOIN user_profiles up ON up.user_id = f1_t.follower_id
            WHERE bcm_t.club_id = c.id
              AND f1_t.follower_id != ${viewerId}
              AND NOT EXISTS (
                SELECT 1 FROM follows fd
                WHERE fd.follower_id = ${viewerId}
                  AND fd.followee_id = bcm_t.user_id
              )
            ORDER BY bcm_t.joined_at DESC
            LIMIT 1
          ) AS "fofUsername",
          COALESCE((
            SELECT json_agg(json_build_object('userId', sub.user_id, 'avatarUrl', sub.avatar_url))
            FROM (
              SELECT bcm2.user_id, up2.avatar_url
              FROM book_club_members bcm2
              LEFT JOIN user_profiles up2 ON up2.user_id = bcm2.user_id
              WHERE bcm2.club_id = c.id
              ORDER BY bcm2.joined_at DESC
              LIMIT 4
            ) sub
          ), '[]'::json) AS "memberPreviews"
        FROM book_clubs c
        INNER JOIN book_club_members bcm ON bcm.club_id = c.id
        INNER JOIN follows f1
          ON f1.followee_id = bcm.user_id
         AND f1.follower_id != ${viewerId}
        INNER JOIN follows f2
          ON f2.followee_id = f1.follower_id
         AND f2.follower_id = ${viewerId}
        WHERE c.visibility = 'PUBLIC'
          AND c.discoverable = true
          AND c.id NOT IN (SELECT club_id FROM book_club_members WHERE user_id = ${viewerId})
          AND c.id NOT IN (${tier1IdsFragment})
          AND NOT EXISTS (
            SELECT 1 FROM follows fd
            WHERE fd.follower_id = ${viewerId}
              AND fd.followee_id = bcm.user_id
          )
        GROUP BY c.id
        ORDER BY COUNT(DISTINCT f2.followee_id) DESC, MAX(bcm.joined_at) DESC
        LIMIT 30
      `),

      // Tier 3 — Trending fallback.
      // Activity-source choice: we use the denorm `book_clubs.last_activity_at`
      // column (D3b shipped this; bumped by discussion create + member join +
      // current book change). Trade-off vs multi-table UNION (counting
      // discussions + member joins + book adds in last 7d): denorm is one
      // index read per club vs three table scans. We accept that last_activity_at
      // doesn't carry weekly *volume* — clubs with one recent event tie with
      // clubs with twenty. Acceptable for v1; revisit if smoke shows poor
      // ordering. Order is `lastActivityAt DESC NULLS LAST, created_at DESC`.
      db.execute(sql`
        SELECT
          c.id,
          c.name,
          c.description,
          c.cover_image_url        AS "coverImageUrl",
          c.visibility,
          c.open_join              AS "openJoin",
          c.member_count           AS "memberCount",
          c.current_book_id        AS "currentBookId",
          (SELECT bcb.title FROM book_club_books bcb
             WHERE bcb.id = c.current_book_id LIMIT 1) AS "currentBookTitle",
          c.last_activity_at       AS "lastActivityAt",
          c.created_at             AS "createdAt",
          COALESCE((
            SELECT json_agg(json_build_object('userId', sub.user_id, 'avatarUrl', sub.avatar_url))
            FROM (
              SELECT bcm2.user_id, up2.avatar_url
              FROM book_club_members bcm2
              LEFT JOIN user_profiles up2 ON up2.user_id = bcm2.user_id
              WHERE bcm2.club_id = c.id
              ORDER BY bcm2.joined_at DESC
              LIMIT 4
            ) sub
          ), '[]'::json) AS "memberPreviews"
        FROM book_clubs c
        WHERE c.visibility = 'PUBLIC'
          AND c.discoverable = true
          AND c.id NOT IN (SELECT club_id FROM book_club_members WHERE user_id = ${viewerId})
          AND c.id NOT IN (${tier1IdsFragment})
        ORDER BY c.last_activity_at DESC NULLS LAST, c.created_at DESC
        LIMIT 30
      `),
    ])

    const tier2Clubs: SuggestedClub[] = (tier2Result.rows as RawTierRow[]).map((row) => {
      const mutualCount = row.mutualCount ?? 0
      const reason = row.fofUsername
        ? `${mutualCount} mutuals via @${row.fofUsername}`
        : `${mutualCount} mutuals`
      return normalizeRow(row, reason)
    })

    const tier3Clubs: SuggestedClub[] = (tier3Result.rows as RawTierRow[]).map((row) =>
      normalizeRow(row, null),
    )

    // Dedupe by id, keep first occurrence (T1 > T2 > T3).
    const seen = new Set<string>()
    const merged: SuggestedClub[] = []
    for (const c of [...tier1Clubs, ...tier2Clubs, ...tier3Clubs]) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      merged.push(c)
      if (merged.length >= limit) break
    }

    return { success: true, data: merged }
  } catch {
    return { success: false, error: 'FETCH_FAILED' }
  }
}
