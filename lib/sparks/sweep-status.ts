import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { sparks } from '@/db/schema/social';

/**
 * Lazy auto-transition for spark statuses. Mirrors the H4 word-goal lazy-sweep
 * precedent — callers invoke this before any list/read query so the displayed
 * status is always accurate without needing a cron.
 *
 *  - OPEN past `deadline` → VOTING.
 *  - VOTING past `voting_ends_at` → CLOSED.
 */
export async function sweepSparkStatuses(): Promise<void> {
  await db
    .update(sparks)
    .set({ status: 'VOTING' })
    .where(and(eq(sparks.status, 'OPEN'), lt(sparks.deadline, sql`now()`)));

  await db
    .update(sparks)
    .set({ status: 'CLOSED' })
    .where(
      and(eq(sparks.status, 'VOTING'), lt(sparks.votingEndsAt, sql`now()`)),
    );
}
