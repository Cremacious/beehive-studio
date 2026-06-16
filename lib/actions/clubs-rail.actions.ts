'use server'

import { db } from '@/db'
import { requireAuth } from '@/lib/require-auth'
import { bookClubMembers } from '@/db/schema/social'
import { and, eq, sql } from 'drizzle-orm'

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
 * Top discoverable PUBLIC clubs sorted by last_activity_at DESC.
 * Projects coverImageUrl + currentBookTitle (per-row correlated subquery against
 * book_club_books since book_clubs.current_book_id references book_club_books.id,
 * NOT books.id) + memberPreviews (correlated subquery against book_club_members,
 * matches T2 pattern).
 */
export async function getTrendingClubsForRailAction(
  args: { limit?: number } = {},
): Promise<ActionResult<RailTrendingClub[]>> {
  const limit = Math.min(args.limit ?? 12, 30)

  try {
    const rows = await db.execute(sql`
      SELECT
        c.id,
        c.name,
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
      ORDER BY c.last_activity_at DESC NULLS LAST, c.created_at DESC
      LIMIT ${limit}
    `)

    type Row = {
      id: string
      name: string
      coverImageUrl: string | null
      currentBookTitle: string | null
      memberCount: number
      lastActivityAt: Date | string | null
      openJoin: boolean
      memberPreviews: Array<{ userId: string; avatarUrl: string | null }>
    }

    return {
      success: true,
      data: rows.rows.map((r) => {
        const row = r as Row
        return {
          id: row.id,
          name: row.name,
          coverImageUrl: row.coverImageUrl,
          currentBookTitle: row.currentBookTitle,
          memberCount: row.memberCount,
          lastActivityAt:
            row.lastActivityAt == null
              ? null
              : row.lastActivityAt instanceof Date
                ? row.lastActivityAt
                : new Date(row.lastActivityAt),
          openJoin: row.openJoin,
          memberPreviews: row.memberPreviews,
        }
      }),
    }
  } catch {
    return { success: false, error: 'FETCH_FAILED' }
  }
}
