import { cache } from 'react'
import { db } from '@/db'
import { notificationPreferences } from '@/db/schema/social'
import { eq } from 'drizzle-orm'
import type { NotificationType } from '@/db/schema/social'

/**
 * React-cache()d single-row lookup of a user's opted-out notification types.
 *
 * The cache memoizes per-render (request) so multiple `shouldSkipNotification`
 * checks against the same user within one server action invocation hit the DB
 * at most once.
 */
export const getOptedOutTypes = cache(
  async (userId: string): Promise<Set<string>> => {
    const row = await db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId),
    })
    return new Set(row?.optedOutTypes ?? [])
  }
)

/**
 * Returns true when the recipient has opted out of receiving a notification
 * of the given type. Callers should skip the `insert(notifications)` write
 * but continue all other source-action side effects (friendship row, like row,
 * etc.) so the source semantics are preserved — only the bell ping is muted.
 */
export async function shouldSkipNotification(
  recipientId: string,
  type: NotificationType
): Promise<boolean> {
  const set = await getOptedOutTypes(recipientId)
  return set.has(type)
}
