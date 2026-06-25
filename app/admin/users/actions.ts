'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { users, userBilling } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/admin/require-admin'
import { logAdminAction } from '@/lib/admin/log-action'
import { runAdminWrite } from '@/lib/admin/safe-admin-action'

// Lifetime = year 9999 sentinel
const LIFETIME_UNTIL = new Date('9999-12-31T00:00:00.000Z')

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
}

export async function grantCompPremiumAction(
  userId: string,
  kind: 'DAYS_30' | 'DAYS_90' | 'DAYS_365' | 'LIFETIME',
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!userId) return { ok: false, error: 'Missing userId.' }

  const now = new Date()
  let until: Date
  switch (kind) {
    case 'DAYS_30':
      until = addDays(now, 30)
      break
    case 'DAYS_90':
      until = addDays(now, 90)
      break
    case 'DAYS_365':
      until = addDays(now, 365)
      break
    case 'LIFETIME':
      until = LIFETIME_UNTIL
      break
  }

  return runAdminWrite(async () => {
    // Upsert: if user_billing row doesn't exist, create it
    const existing = await db.query.userBilling.findFirst({
      where: eq(userBilling.userId, userId),
      columns: { userId: true, compEntitlementUntil: true },
    })
    if (existing) {
      // If they already have a comp window further in the future, keep the later one
      const current = existing.compEntitlementUntil
      const next = current && current.getTime() > until.getTime() ? current : until
      await db
        .update(userBilling)
        .set({ compEntitlementUntil: next })
        .where(eq(userBilling.userId, userId))
    } else {
      await db.insert(userBilling).values({ userId, compEntitlementUntil: until })
    }

    await logAdminAction({
      adminEmail: admin.email,
      action: 'user.grant_comp_premium',
      targetType: 'user',
      targetId: userId,
      metadata: { kind, until: until.toISOString() },
    })
    revalidatePath('/admin/users')
  })
}

export async function revokeCompPremiumAction(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!userId) return { ok: false, error: 'Missing userId.' }

  return runAdminWrite(async () => {
    await db
      .update(userBilling)
      .set({ compEntitlementUntil: null })
      .where(eq(userBilling.userId, userId))

    await logAdminAction({
      adminEmail: admin.email,
      action: 'user.revoke_comp_premium',
      targetType: 'user',
      targetId: userId,
    })
    revalidatePath('/admin/users')
  })
}

export async function setBannedAction(
  userId: string,
  banned: boolean,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!userId) return { ok: false, error: 'Missing userId.' }

  return runAdminWrite(async () => {
    await db
      .update(users)
      .set({
        banned,
        bannedAt: banned ? new Date() : null,
        bannedReason: banned ? reason ?? null : null,
      })
      .where(eq(users.id, userId))

    await logAdminAction({
      adminEmail: admin.email,
      action: banned ? 'user.ban' : 'user.unban',
      targetType: 'user',
      targetId: userId,
      metadata: banned && reason ? { reason } : null,
    })
    revalidatePath('/admin/users')
  })
}

export async function deleteUserAction(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!userId) return { ok: false, error: 'Missing userId.' }

  return runAdminWrite(async () => {
    // CASCADE FKs across the app delete all owned content.
    await db.delete(users).where(eq(users.id, userId))

    await logAdminAction({
      adminEmail: admin.email,
      action: 'user.delete',
      targetType: 'user',
      targetId: userId,
    })
    revalidatePath('/admin/users')
  })
}
