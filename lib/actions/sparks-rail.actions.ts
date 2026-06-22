'use server'

import { db } from '@/db'
import { sparks, sparkEntries } from '@/db/schema/social'
import { requireAuth } from '@/lib/require-auth'
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { computeTrendingScore } from '@/lib/discover/scoring'

export type RailTrendingSpark = {
  id: string
  title: string
  status: 'OPEN' | 'VOTING' | 'CLOSED'
  entryCount: number
  deadline: Date | null
}

export type ViewerSparkStats = {
  created: number
  entered: number
  entriesReceived: number
  wins: number
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string }

const CANDIDATE_LIMIT = 60

/**
 * Issue #32: Top sparks ranked by time-decayed engagement (cumulative entry
 * count as the primary signal, divided by age decay). Sparks have no
 * likes/comments/bookmarks; entryCount feeds `likeCount` in computeTrendingScore.
 * TODO(#32): wrap in unstable_cache (5min TTL, key on limit).
 */
export async function getTrendingSparksForRailAction(
  args: { limit?: number } = {},
): Promise<ActionResult<RailTrendingSpark[]>> {
  const limit = Math.min(args.limit ?? 3, 10)

  try {
    const rows = await db
      .select({
        id: sparks.id,
        title: sparks.title,
        deadline: sparks.deadline,
        status: sparks.status,
        createdAt: sparks.createdAt,
        entryCount: sql<number>`COUNT(${sparkEntries.id})::int`,
      })
      .from(sparks)
      .leftJoin(sparkEntries, eq(sparkEntries.sparkId, sparks.id))
      .where(
        and(
          eq(sparks.visibility, 'PUBLIC'),
          // OPEN or VOTING — both still surfaceable on a "trending now" rail
          sql`${sparks.status} IN ('OPEN', 'VOTING')`,
        ),
      )
      .groupBy(
        sparks.id,
        sparks.title,
        sparks.deadline,
        sparks.status,
        sparks.createdAt,
      )
      .limit(CANDIDATE_LIMIT)

    const now = Date.now()
    const scored = rows.map((r) => {
      const hoursAgo = Math.max(0, (now - r.createdAt.getTime()) / 3_600_000)
      const score = computeTrendingScore({
        likeCount: r.entryCount,
        commentCount: 0,
        bookmarkCount: 0,
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
        title: r.title,
        status: r.status as RailTrendingSpark['status'],
        entryCount: r.entryCount,
        deadline: r.deadline,
      })),
    }
  } catch {
    return { success: false, error: 'FETCH_FAILED' }
  }
}

/**
 * Four counts for the viewer's "Your spark stats" panel.
 * Runs 4 parallel COUNT(*) queries (cheap on indexed columns).
 */
export async function getViewerSparkStatsAction(): Promise<ActionResult<ViewerSparkStats>> {
  const viewerId = await requireAuth()

  try {
    const [createdRows, enteredRows, receivedRows, winRows] = await Promise.all([
      db
        .select({ n: sql<number>`COUNT(*)::int` })
        .from(sparks)
        .where(eq(sparks.creatorId, viewerId)),
      db
        .select({ n: sql<number>`COUNT(*)::int` })
        .from(sparkEntries)
        .where(eq(sparkEntries.userId, viewerId)),
      db
        .select({ n: sql<number>`COUNT(${sparkEntries.id})::int` })
        .from(sparkEntries)
        .innerJoin(sparks, eq(sparks.id, sparkEntries.sparkId))
        .where(eq(sparks.creatorId, viewerId)),
      db
        .select({ n: sql<number>`COUNT(*)::int` })
        .from(sparkEntries)
        .innerJoin(sparks, eq(sparks.id, sparkEntries.sparkId))
        .where(
          and(
            eq(sparkEntries.userId, viewerId),
            isNotNull(sparks.winnerEntryId),
            eq(sparks.winnerEntryId, sparkEntries.id),
          ),
        ),
    ])

    return {
      success: true,
      data: {
        created: createdRows[0]?.n ?? 0,
        entered: enteredRows[0]?.n ?? 0,
        entriesReceived: receivedRows[0]?.n ?? 0,
        wins: winRows[0]?.n ?? 0,
      },
    }
  } catch {
    return { success: false, error: 'FETCH_FAILED' }
  }
}
