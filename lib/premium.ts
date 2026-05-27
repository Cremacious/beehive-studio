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

/** Returns the max number of members a hive can have for the given tier. */
export function getHiveMemberLimitForTier(isPremium: boolean): number {
  return isPremium ? Infinity : FREE_HIVE_MEMBER_LIMIT
}

/**
 * Queries whether the given user has an active premium subscription.
 * Returns false if the userBilling row doesn't exist yet (new users).
 *
 * Dev override: set DEV_FORCE_PREMIUM=true in .env.local to force premium
 * for any logged-in user. Only honored when NODE_ENV !== 'production'.
 */
export async function getUserPremiumStatus(_userId: string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_FORCE_PREMIUM === 'true') {
    return true
  }
  // TODO(P8A Task 3): derive from subscriptionStatus IN ('active', 'trialing').
  // Task 1 dropped the premium boolean column; this is a temporary stub so
  // tsc passes between Task 1 and Task 3.
  return false
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
