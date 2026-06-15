'use server'

import { db } from '@/db'
import { sparks, sparkEntries } from '@/db/schema/social'
import { requireAuth } from '@/lib/require-auth'
import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm'

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

const TRENDING_WINDOW_MS = 7 * 86_400_000

/**
 * Top sparks ranked by entries-this-week across PUBLIC discoverable sparks
 * in OPEN/VOTING status. Used by the Sparks Hub right rail.
 */
export async function getTrendingSparksForRailAction(
  args: { limit?: number } = {},
): Promise<ActionResult<RailTrendingSpark[]>> {
  const limit = Math.min(args.limit ?? 3, 10)
  const windowStart = new Date(Date.now() - TRENDING_WINDOW_MS)

  try {
    const rows = await db
      .select({
        id: sparks.id,
        title: sparks.title,
        deadline: sparks.deadline,
        status: sparks.status,
        entryCount: sql<number>`COUNT(${sparkEntries.id})::int`,
      })
      .from(sparks)
      .leftJoin(
        sparkEntries,
        and(
          eq(sparkEntries.sparkId, sparks.id),
          gte(sparkEntries.createdAt, windowStart),
        ),
      )
      .where(
        and(
          eq(sparks.visibility, 'PUBLIC'),
          // OPEN or VOTING — both still surfaceable on a "trending now" rail
          sql`${sparks.status} IN ('OPEN', 'VOTING')`,
        ),
      )
      .groupBy(sparks.id, sparks.title, sparks.deadline, sparks.status)
      .orderBy(desc(sql`COUNT(${sparkEntries.id})`))
      .limit(limit)

    return {
      success: true,
      data: rows.map((r) => ({
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
