// lib/mentions/record-mention-notifications.ts
import { notifications } from '@/db/schema/social'
import type { SurfaceType } from './surface-types'
import { db } from '@/db'

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function recordMentionNotificationsTx(
  tx: DrizzleTx,
  opts: { actorId: string; mentionedUserIds: string[]; resourceType: SurfaceType; resourceId: string }
): Promise<void> {
  if (opts.mentionedUserIds.length === 0) return
  await tx.insert(notifications).values(
    opts.mentionedUserIds.map((userId) => ({
      userId,
      type: 'MENTION' as const,
      actorId: opts.actorId,
      resourceType: opts.resourceType,
      resourceId: opts.resourceId,
    }))
  )
}
