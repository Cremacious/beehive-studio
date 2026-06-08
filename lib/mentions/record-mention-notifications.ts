// lib/mentions/record-mention-notifications.ts
import { notifications } from '@/db/schema/social'
import type { SurfaceType } from './surface-types'
import { db } from '@/db'
import { shouldSkipNotification } from '@/lib/notifications/check-preferences'

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function recordMentionNotificationsTx(
  tx: DrizzleTx,
  opts: { actorId: string; mentionedUserIds: string[]; resourceType: SurfaceType; resourceId: string }
): Promise<void> {
  if (opts.mentionedUserIds.length === 0) return
  // C5b T3: per-recipient skip filter — opt-out of MENTION suppresses bell
  // ping but other source-action writes continue normally.
  const skipResults = await Promise.all(
    opts.mentionedUserIds.map((id) => shouldSkipNotification(id, 'MENTION'))
  )
  const filteredIds = opts.mentionedUserIds.filter((_, i) => !skipResults[i])
  if (filteredIds.length === 0) return
  await tx.insert(notifications).values(
    filteredIds.map((userId) => ({
      userId,
      type: 'MENTION' as const,
      actorId: opts.actorId,
      resourceType: opts.resourceType,
      resourceId: opts.resourceId,
    }))
  )
}
