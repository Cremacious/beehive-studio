'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { promoCodes, promoRedemptions, userBilling } from '@/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'

const LIFETIME_UNTIL = new Date('9999-12-31T00:00:00.000Z')

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
}

export interface RedeemResult {
  ok: boolean
  error?: string
  grantLabel?: string
}

export async function redeemPromoCodeAction(formData: FormData): Promise<RedeemResult> {
  let userId: string
  try {
    userId = await requireAuth()
  } catch {
    return { ok: false, error: 'Please sign in to redeem a code.' }
  }
  const raw = String(formData.get('code') ?? '').trim().toUpperCase()
  const code = raw.replace(/[^A-Z0-9\-_]/g, '')
  if (!code) return { ok: false, error: 'Enter a code.' }

  let promo: typeof promoCodes.$inferSelect | undefined
  let already: typeof promoRedemptions.$inferSelect | undefined
  try {
    promo = await db.query.promoCodes.findFirst({
      where: eq(promoCodes.code, code),
    })
    if (promo) {
      already = await db.query.promoRedemptions.findFirst({
        where: and(
          eq(promoRedemptions.promoCodeId, promo.id),
          eq(promoRedemptions.userId, userId),
        ),
      })
    }
  } catch {
    return { ok: false, error: 'Could not redeem code. Please try again.' }
  }
  if (!promo) return { ok: false, error: 'Invalid code.' }
  if (promo.isActive !== 'true') return { ok: false, error: 'This code is no longer active.' }
  if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'This code has expired.' }
  }
  if (promo.maxUses != null && promo.usesCount >= promo.maxUses) {
    return { ok: false, error: 'This code has been fully redeemed.' }
  }
  if (already) return { ok: false, error: 'You have already redeemed this code.' }

  const now = new Date()
  let until: Date
  let label: string
  switch (promo.kind) {
    case 'DAYS_30':
      until = addDays(now, 30)
      label = '30 days of premium'
      break
    case 'DAYS_90':
      until = addDays(now, 90)
      label = '90 days of premium'
      break
    case 'DAYS_365':
      until = addDays(now, 365)
      label = '1 year of premium'
      break
    case 'LIFETIME':
      until = LIFETIME_UNTIL
      label = 'lifetime premium'
      break
    default:
      return { ok: false, error: 'Unknown grant kind.' }
  }

  try {
    await db.transaction(async (tx) => {
      // Upsert user_billing.comp_entitlement_until — extend if existing is sooner.
      const existing = await tx.query.userBilling.findFirst({
        where: eq(userBilling.userId, userId),
        columns: { userId: true, compEntitlementUntil: true },
      })
      if (existing) {
        const current = existing.compEntitlementUntil
        const next = current && current.getTime() > until.getTime() ? current : until
        await tx
          .update(userBilling)
          .set({ compEntitlementUntil: next })
          .where(eq(userBilling.userId, userId))
      } else {
        await tx.insert(userBilling).values({ userId, compEntitlementUntil: until })
      }

      await tx.insert(promoRedemptions).values({
        promoCodeId: promo.id,
        userId,
        grantedUntil: until,
      })

      await tx
        .update(promoCodes)
        .set({ usesCount: sql`${promoCodes.usesCount} + 1` })
        .where(eq(promoCodes.id, promo.id))
    })
  } catch (e) {
    return { ok: false, error: 'Could not redeem code. Please try again.' }
  }

  revalidatePath('/settings/billing')
  return { ok: true, grantLabel: label }
}
