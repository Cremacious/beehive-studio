import { db } from '@/db'
import { adminActions } from '@/db/schema'

export interface AdminActionLog {
  adminEmail: string
  action: string
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Append a row to admin_actions. Wrapped in try/catch so a logging failure
 * never breaks the originating admin write. Use this from every admin
 * mutation server action.
 */
export async function logAdminAction(entry: AdminActionLog): Promise<void> {
  try {
    await db.insert(adminActions).values({
      adminEmail: entry.adminEmail,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? null,
    })
  } catch (err) {
    console.warn('[admin] failed to log action', entry, err)
  }
}
