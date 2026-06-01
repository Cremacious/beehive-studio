import { db } from '@/db'
import { hiveWordLogs } from '@/db/schema/hive'
import { and, desc, eq, sql } from 'drizzle-orm'
import { getBookHive } from '@/lib/hive/get-book-hive'
import { computeWordDelta } from '@/lib/hive/word-delta'
import { requireHiveMember } from '@/lib/hive/permissions'

const THROTTLE_MS = 60_000

export interface LogHiveWordDeltaOpts {
  bookId: string
  userId: string
  chapterId: string
  currentWordCount: number
}

/**
 * Optionally append a hive_word_logs row for this save.
 *
 *  1. If book has no hive → no-op.
 *  2. If user is not a hive member → no-op.
 *  3. If the most recent log for (hive, user, chapter) is younger than 60s → no-op (throttle).
 *  4. Otherwise: delta = currentWordCount - SUM(prior logs); insert row.
 *
 * Wrapped in try/catch so failures NEVER throw into the caller. Saves must
 * succeed even if the hive-log write blows up.
 */
export async function logHiveWordDelta(opts: LogHiveWordDeltaOpts): Promise<void> {
  try {
    const hive = await getBookHive(opts.bookId)
    if (!hive) return

    // Membership check (silent no-op for non-members)
    try {
      await requireHiveMember(hive.hiveId, opts.userId)
    } catch {
      return
    }

    // Throttle check
    const mostRecent = await db.query.hiveWordLogs.findFirst({
      where: and(
        eq(hiveWordLogs.hiveId, hive.hiveId),
        eq(hiveWordLogs.userId, opts.userId),
        eq(hiveWordLogs.chapterId, opts.chapterId),
      ),
      orderBy: [desc(hiveWordLogs.loggedAt)],
      columns: { loggedAt: true },
    })
    if (mostRecent && mostRecent.loggedAt > new Date(Date.now() - THROTTLE_MS)) {
      return
    }

    // Compute prior sum
    const priorSumRow = await db
      .select({ sum: sql<number>`COALESCE(SUM(${hiveWordLogs.wordsAdded}), 0)::int` })
      .from(hiveWordLogs)
      .where(and(
        eq(hiveWordLogs.userId, opts.userId),
        eq(hiveWordLogs.chapterId, opts.chapterId),
      ))
    const priorSum = priorSumRow[0]?.sum ?? 0
    const delta = computeWordDelta(opts.currentWordCount, priorSum)
    if (delta === 0) return // skip no-op rows to keep the table lean

    await db.insert(hiveWordLogs).values({
      hiveId: hive.hiveId,
      userId: opts.userId,
      chapterId: opts.chapterId,
      wordsAdded: delta,
    })
  } catch (e) {
    console.error('[H4] log-word-delta failed', e)
  }
}
