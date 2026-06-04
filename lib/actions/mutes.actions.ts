'use server'

import { db } from '@/db'
import { userMutes } from '@/db/schema/social'
import { and, eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { userTargetSchema } from '@/lib/validations/social'
import type { ActionResult } from './book.actions'

export async function muteUserAction(
  input: unknown,
): Promise<ActionResult<{ muted: boolean }>> {
  const userId = await requireAuth()
  const parsed = userTargetSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }
  const { targetUserId } = parsed.data
  if (targetUserId === userId) return { success: false, error: 'SELF_MUTE' }

  await db
    .insert(userMutes)
    .values({ muterId: userId, mutedId: targetUserId })
    .onConflictDoNothing()

  return { success: true, data: { muted: true } }
}

export async function unmuteUserAction(
  input: unknown,
): Promise<ActionResult<{ removed: boolean }>> {
  const userId = await requireAuth()
  const parsed = userTargetSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }
  const { targetUserId } = parsed.data

  await db
    .delete(userMutes)
    .where(
      and(eq(userMutes.muterId, userId), eq(userMutes.mutedId, targetUserId)),
    )

  return { success: true, data: { removed: true } }
}

export async function getMutedUsersAction(): Promise<ActionResult<string[]>> {
  const userId = await requireAuth()
  const rows = await db.query.userMutes.findMany({
    where: eq(userMutes.muterId, userId),
    columns: { mutedId: true },
  })
  return { success: true, data: rows.map((r) => r.mutedId) }
}
