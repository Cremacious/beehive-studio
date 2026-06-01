import { db } from '@/db'
import { friendships } from '@/db/schema'
import { and, eq, or } from 'drizzle-orm'

/**
 * Returns true iff there is an ACCEPTED friendship row between the two users
 * (in either direction). Order-agnostic.
 */
export async function areUsersFriends(userIdA: string, userIdB: string): Promise<boolean> {
  if (!userIdA || !userIdB || userIdA === userIdB) return false
  const rows = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'ACCEPTED'),
        or(
          and(eq(friendships.requesterId, userIdA), eq(friendships.recipientId, userIdB)),
          and(eq(friendships.requesterId, userIdB), eq(friendships.recipientId, userIdA)),
        ),
      ),
    )
    .limit(1)
  return rows.length > 0
}
