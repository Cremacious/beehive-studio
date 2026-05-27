import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const FREE_BOOK_LIMIT = 3
export const FREE_HIVE_LIMIT = 3
export const FREE_HIVE_MEMBER_LIMIT = 5

const PREMIUM_STATUSES = new Set(['active', 'trialing', 'past_due'])

/** Returns the max number of active books for the given tier. */
export function getBookLimitForTier(isPremium: boolean): number {
  return isPremium ? Infinity : FREE_BOOK_LIMIT
}

/** Returns the max number of active hives for the given tier. */
export function getHiveLimitForTier(isPremium: boolean): number {
  return isPremium ? Infinity : FREE_HIVE_LIMIT
}

/** Returns the max number of members a hive can have for the given tier. */
export function getHiveMemberLimitForTier(isPremium: boolean): number {
  return isPremium ? Infinity : FREE_HIVE_MEMBER_LIMIT
}

/**
 * Returns true if the user has an active or trialing subscription, OR is in
 * Stripe's grace period (past_due). The grace period typically lasts ~3 weeks
 * while Stripe retries failed payments. Treating past_due as premium prevents
 * a card hiccup from immediately cutting off access; once Stripe gives up the
 * retry cycle, the webhook sets the status to 'canceled' and access reverts.
 *
 * Returns false if the userBilling row doesn't exist yet (new users) or the
 * status is anything else.
 *
 * Dev override: set DEV_FORCE_PREMIUM=true in .env.local to force premium
 * for any logged-in user. Only honored when NODE_ENV !== 'production'.
 */
export async function getUserPremiumStatus(userId: string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_FORCE_PREMIUM === 'true') {
    return true
  }

  const billing = await db.query.userBilling.findFirst({
    where: eq(userBilling.userId, userId),
    columns: { subscriptionStatus: true },
  })

  return billing?.subscriptionStatus ? PREMIUM_STATUSES.has(billing.subscriptionStatus) : false
}

/**
 * Throws a descriptive error if the user is not premium.
 * Use in server actions before premium-gated operations.
 */
export function requirePremium(isPremium: boolean, featureName: string): void {
  if (!isPremium) {
    throw new Error(`PREMIUM_REQUIRED:${featureName}`)
  }
}
