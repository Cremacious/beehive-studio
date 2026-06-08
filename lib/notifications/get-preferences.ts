'use server'

import { db } from '@/db'
import { notificationPreferences } from '@/db/schema/social'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import type { ActionResult } from '@/lib/actions/book.actions'
import type { NotificationType } from '@/db/schema/social'

export async function getNotificationPreferencesAction(): Promise<
  ActionResult<{ optedOutTypes: NotificationType[] }>
> {
  const userId = await requireAuth()
  const row = await db.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  })
  return {
    success: true,
    data: { optedOutTypes: (row?.optedOutTypes ?? []) as NotificationType[] },
  }
}
