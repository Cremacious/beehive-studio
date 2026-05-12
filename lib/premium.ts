import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const FREE_BOOK_LIMIT = 3
export const FREE_HIVE_LIMIT = 3
export const FREE_HIVE_MEMBER_LIMIT = 5

/** Returns the max number of active books for the given tier. */
export function getBookLimitForTier(isPremium: boolean): number {
  return isPremium ? Infinity : FREE_BOOK_LIMIT
}

/** Returns the max number of active hives for the given tier. */
export function getHiveLimitForTier(isPremium: boolean): number {
  return isPremium ? Infinity : FREE_HIVE_LIMIT
}

/**
 * Queries whether the given user has an active premium subscription.
 * Returns false if the userBilling row doesn't exist yet (new users).
 */
export async function getUserPremiumStatus(userId: string): Promise<boolean> {
  const billing = await db.query.userBilling.findFirst({
    where: eq(userBilling.userId, userId),
    columns: { premium: true },
  })
  return billing?.premium ?? false
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
