'use server'

import { unstable_cache } from 'next/cache'
import { db } from '@/db'
import { requireAuth } from '@/lib/require-auth'
import { bookClubMembers } from '@/db/schema/social'
import { and, eq, sql } from 'drizzle-orm'
import { computeTrendingScore } from '@/lib/discover/scoring'

export type ViewerClubStats = {
  owned: number
  memberOf: number
  booksFinished: number
  currentlyReading: number
}

export type RailTrendingClub = {
  id: string
  name: string
  coverImageUrl: string | null
  currentBookTitle: string | null
  memberCount: number
  lastActivityAt: Date | null
  openJoin: boolean
  memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
}

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Four counts for the viewer's "Your club stats" rail panel.
 *  - owned: viewer is OWNER of N clubs
 *  - memberOf: viewer is non-OWNER member of N clubs
 *  - booksFinished: count of past (status='PAST') book entries across viewer's clubs
 *  - currentlyReading: count of viewer's clubs that have a current book set
 */
export async function getViewerClubStatsAction(): Promise<
  ActionResult<ViewerClubStats>
> {
  const viewerId = await requireAuth()

  try {
    const [ownedRows, memberRows, booksFinishedRows, currentlyReadingRows] =
      await Promise.all([
        db
          .select({ n: sql<number>`COUNT(*)::int` })
          .from(bookClubMembers)
          .where(
            and(
              eq(bookClubMembers.userId, viewerId),
              eq(bookClubMembers.role, 'OWNER'),
            ),
          ),
        db
          .select({ n: sql<number>`COUNT(*)::int` })
          .from(bookClubMembers)
          .where(
            and(
              eq(bookClubMembers.userId, viewerId),
              sql`${bookClubMembers.role} != 'OWNER'`,
            ),
          ),
        // Books finished — count PAST book_club_books rows in clubs viewer is a member of.
        db.execute(sql`
          SELECT COUNT(*)::int AS n
          FROM book_club_books bcb
          INNER JOIN book_club_members bcm ON bcm.club_id = bcb.club_id
          WHERE bcm.user_id = ${viewerId}
            AND bcb.status = 'PAST'
        `),
        // Currently reading — distinct clubs viewer is a member of that have a current book set.
        db.execute(sql`
          SELECT COUNT(DISTINCT c.id)::int AS n
          FROM book_clubs c
          INNER JOIN book_club_members bcm ON bcm.club_id = c.id
          WHERE bcm.user_id = ${viewerId}
            AND c.current_book_id IS NOT NULL
        `),
      ])

    return {
      success: true,
      data: {
        owned: ownedRows[0]?.n ?? 0,
        memberOf: memberRows[0]?.n ?? 0,
        booksFinished:
          (booksFinishedRows.rows[0] as { n?: number } | undefined)?.n ?? 0,
        currentlyReading:
          (currentlyReadingRows.rows[0] as { n?: number } | undefined)?.n ?? 0,
      },
    }
  } catch {
    return { success: false, error: 'FETCH_FAILED' }
  }
}

/**
 * Issue #32: Top discoverable PUBLIC clubs ranked by time-decayed engagement.
 * memberCount feeds `likeCount`; discussionCount feeds `commentCount`;
 * hoursAgo from created_at. last_activity_at is still projected for display
 * but no longer dictates ordering. Cached 5min via unstable_cache; viewer-agnostic.
 */
const CANDIDATE_LIMIT_CLUBS = 60
const computeTrendingClubs = unstable_cache(
  async (limit: number): Promise<RailTrendingClub[]> => {
    const rows = await db.execute(sql`
      SELECT
        c.id,
        c.name,
        c.created_at AS "createdAt",
        c.cover_image_url AS "coverImageUrl",
        (
          SELECT bcb.title
          FROM book_club_books bcb
          WHERE bcb.id = c.current_book_id
          LIMIT 1
        ) AS "currentBookTitle",
        c.member_count AS "memberCount",
        c.last_activity_at AS "lastActivityAt",
        c.open_join AS "openJoin",
        COALESCE((
          SELECT COUNT(*)::int FROM book_club_discussions bcd WHERE bcd.club_id = c.id
        ), 0) AS "discussionCount",
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
      WHERE c.visibility = 'PUBLIC' AND c.discoverable = true
      LIMIT ${CANDIDATE_LIMIT_CLUBS}
    `)

    type Row = {
      id: string
      name: string
      createdAt: Date | string
      coverImageUrl: string | null
      currentBookTitle: string | null
      memberCount: number
      lastActivityAt: Date | string | null
      openJoin: boolean
      discussionCount: number
      memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
    }

    const now = Date.now()
    const scored = (rows.rows as Row[]).map((r) => {
      const created =
        r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)
      const hoursAgo = Math.max(0, (now - created.getTime()) / 3_600_000)
      const score = computeTrendingScore({
        likeCount: Number(r.memberCount ?? 0),
        commentCount: Number(r.discussionCount ?? 0),
        bookmarkCount: 0,
        hoursAgo,
      })
      return { row: r, score }
    })
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.row.id.localeCompare(a.row.id)
    })

    return scored.slice(0, limit).map(({ row }) => ({
      id: row.id,
      name: row.name,
      coverImageUrl: row.coverImageUrl,
      currentBookTitle: row.currentBookTitle,
      memberCount: Number(row.memberCount ?? 0),
      lastActivityAt:
        row.lastActivityAt == null
          ? null
          : row.lastActivityAt instanceof Date
            ? row.lastActivityAt
            : new Date(row.lastActivityAt),
      openJoin: row.openJoin,
      memberPreviews: row.memberPreviews,
    }))
  },
  ['trending-clubs-rail'],
  { revalidate: 300, tags: ['trending-clubs'] },
)

export async function getTrendingClubsForRailAction(
  args: { limit?: number } = {},
): Promise<ActionResult<RailTrendingClub[]>> {
  const limit = Math.min(args.limit ?? 12, 30)
  try {
    const data = await computeTrendingClubs(limit)
    return { success: true, data }
  } catch {
    return { success: false, error: 'FETCH_FAILED' }
  }
}
