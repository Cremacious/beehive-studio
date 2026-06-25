'use server'

import { db } from '@/db'
import { userBlocks, friendships, follows } from '@/db/schema/social'
import { and, eq, or } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { userTargetSchema } from '@/lib/validations/social'
import { runAction } from './safe-action'
import type { ActionResult } from './book.actions'

export async function blockUserAction(
  input: unknown,
): Promise<ActionResult<{ blocked: boolean }>> {
  return runAction(async () => {
  const userId = await requireAuth()
  const parsed = userTargetSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }
  const { targetUserId } = parsed.data
  if (targetUserId === userId) return { success: false, error: 'SELF_BLOCK' }

  await db.transaction(async (tx) => {
    await tx
      .insert(userBlocks)
      .values({ blockerId: userId, blockedId: targetUserId })
      .onConflictDoNothing()

    await tx
      .delete(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, userId),
            eq(friendships.recipientId, targetUserId),
          ),
          and(
            eq(friendships.requesterId, targetUserId),
            eq(friendships.recipientId, userId),
          ),
        ),
      )

    await tx
      .delete(follows)
      .where(
        or(
          and(
            eq(follows.followerId, userId),
            eq(follows.followeeId, targetUserId),
          ),
          and(
            eq(follows.followerId, targetUserId),
            eq(follows.followeeId, userId),
          ),
        ),
      )
  })

  return { success: true, data: { blocked: true } }
  })
}

export async function unblockUserAction(
  input: unknown,
): Promise<ActionResult<{ removed: boolean }>> {
  return runAction(async () => {
  const userId = await requireAuth()
  const parsed = userTargetSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }
  const { targetUserId } = parsed.data

  await db
    .delete(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerId, userId),
        eq(userBlocks.blockedId, targetUserId),
      ),
    )

  return { success: true, data: { removed: true } }
  })
}

export async function getBlockedUsersAction(): Promise<ActionResult<string[]>> {
  const userId = await requireAuth()
  const rows = await db.query.userBlocks.findMany({
    where: eq(userBlocks.blockerId, userId),
    columns: { blockedId: true },
  })
  return { success: true, data: rows.map((r) => r.blockedId) }
}
