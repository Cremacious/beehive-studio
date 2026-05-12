'use server'

import { db } from '@/db'
import { notifications } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import type { ActionResult } from './book.actions'

export type NotificationRow = {
  id: string
  type: string
  actorId: string | null
  resourceType: string | null
  resourceId: string | null
  read: boolean
  createdAt: Date
  actor: { name: string | null; image: string | null } | null
}

export async function getNotificationsAction(): Promise<ActionResult<{ notifications: NotificationRow[]; unreadCount: number }>> {
  const userId = await requireAuth()

  const rows = await db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: [desc(notifications.createdAt)],
    limit: 30,
    with: {
      actor: { columns: { name: true, image: true } },
    },
  })

  const unreadCount = rows.filter(n => !n.read).length
  return { success: true, data: { notifications: rows as NotificationRow[], unreadCount } }
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  const userId = await requireAuth()
  await db.update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, notificationId))
  return { success: true, data: undefined }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const userId = await requireAuth()
  await db.update(notifications)
    .set({ read: true })
    .where(eq(notifications.userId, userId))
  return { success: true, data: undefined }
}
