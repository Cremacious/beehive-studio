'use server'

import { db } from '@/db'
import { notifications } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { runAction } from './safe-action'
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
  return runAction(async () => {
  const userId = await requireAuth()
  // Scope to userId so an authed user can't mark another user's notifications
  // read by guessing IDs. Previously the userId from requireAuth was unused.
  await db.update(notifications)
    .set({ read: true })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId),
    ))
  return { success: true, data: undefined }
  })
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  return runAction(async () => {
  const userId = await requireAuth()
  // Filter on read=false so we only touch rows that need updating — perf win
  // on accounts with large notification history.
  await db.update(notifications)
    .set({ read: true })
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.read, false),
    ))
  return { success: true, data: undefined }
  })
}
