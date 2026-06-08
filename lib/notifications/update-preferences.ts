'use server'

import { db } from '@/db'
import { notificationPreferences } from '@/db/schema/social'
import { requireAuth } from '@/lib/require-auth'
import { updatePreferenceSchema } from '@/lib/validations/notifications'
import type { ActionResult } from '@/lib/actions/book.actions'
import type { NotificationType } from '@/db/schema/social'

export async function updateNotificationPreferenceAction(input: {
  type: string
  optedOut: boolean
}): Promise<ActionResult<{ optedOutTypes: NotificationType[] }>> {
  const userId = await requireAuth()
  const parsed = updatePreferenceSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'INVALID_INPUT' }

  return await db.transaction(async (tx) => {
    const existing = await tx.query.notificationPreferences.findFirst({
      where: (np, { eq }) => eq(np.userId, userId),
    })
    const current = new Set<string>(existing?.optedOutTypes ?? [])
    if (parsed.data.optedOut) current.add(parsed.data.type)
    else current.delete(parsed.data.type)
    const nextArray = Array.from(current)

    await tx
      .insert(notificationPreferences)
      .values({ userId, optedOutTypes: nextArray })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: { optedOutTypes: nextArray, updatedAt: new Date() },
      })

    return {
      success: true,
      data: { optedOutTypes: nextArray as NotificationType[] },
    }
  })
}
