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
export async function recordHiveActivity(opts: {
  hiveId: string
  actorId: string
  type: HiveActivityType
  subjectId?: string | null
  payload?: unknown
}): Promise<void> {
  await db.insert(hiveActivity).values({
    hiveId: opts.hiveId,
    actorId: opts.actorId,
    type: opts.type,
    subjectId: opts.subjectId ?? null,
    payload: opts.payload ?? null,
  })
}
