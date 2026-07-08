'use server'

import { db } from '@/db'
import { notifications, userProfiles } from '@/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
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
  // Onboarding-chosen identity only (issue #55). The bell renders
  // displayName ?? @username ?? 'Someone' — never the Google/OAuth name.
  actor: { displayName: string | null; username: string | null } | null
}

export async function getNotificationsAction(): Promise<ActionResult<{ notifications: NotificationRow[]; unreadCount: number }>> {
  const userId = await requireAuth()

  const rows = await db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: [desc(notifications.createdAt)],
    limit: 30,
  })

  // Resolve actor identity from userProfiles, NOT the OAuth users table.
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((id): id is string => id != null))]
  const profiles = actorIds.length
    ? await db
        .select({
          userId: userProfiles.userId,
          displayName: userProfiles.displayName,
          username: userProfiles.username,
        })
        .from(userProfiles)
        .where(inArray(userProfiles.userId, actorIds))
    : []
  const profileMap = new Map(profiles.map((p) => [p.userId, p]))

  const data: NotificationRow[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    actorId: n.actorId,
    resourceType: n.resourceType,
    resourceId: n.resourceId,
    read: n.read,
    createdAt: n.createdAt,
    actor: n.actorId
      ? {
          displayName: profileMap.get(n.actorId)?.displayName ?? null,
          username: profileMap.get(n.actorId)?.username ?? null,
        }
      : null,
  }))

  const unreadCount = data.filter((n) => !n.read).length
  return { success: true, data: { notifications: data, unreadCount } }
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
