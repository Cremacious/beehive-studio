import { db } from '@/db'
import { hiveActivity } from '@/db/schema'

export type HiveActivityType =
  | 'chapter_submitted'
  | 'chapter_submitted_approved'
  | 'chapter_submitted_rejected'
  | 'annotation_added'
  | 'suggestion_proposed'
  | 'suggestion_accepted'
  | 'suggestion_rejected'
  | 'buzz_posted'
  | 'discussion_posted'
  | 'member_joined'

/**
 * Inserts one row into hive_activity. Callers should invoke this in the
 * same DB transaction as the source-row insert when possible.
 */
export type HiveActivityOpts = {
  hiveId: string
  actorId: string
  type: HiveActivityType
  subjectId?: string | null
  payload?: unknown
}

export async function recordHiveActivity(opts: HiveActivityOpts): Promise<void> {
  await db.insert(hiveActivity).values({
    hiveId: opts.hiveId,
    actorId: opts.actorId,
    type: opts.type,
    subjectId: opts.subjectId ?? null,
    payload: opts.payload ?? null,
  })
}

// drizzle tx handle (the inner argument of the db.transaction callback)
export type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Transaction-aware sibling — same shape as `recordHiveActivity` but writes via
 * the supplied tx handle so the activity row commits atomically with the
 * caller's source-row insert.
 */
export async function recordHiveActivityTx(
  tx: DrizzleTx,
  opts: HiveActivityOpts,
): Promise<void> {
  await tx.insert(hiveActivity).values({
    hiveId: opts.hiveId,
    actorId: opts.actorId,
    type: opts.type,
    subjectId: opts.subjectId ?? null,
    payload: opts.payload ?? null,
  })
}
