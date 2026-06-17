'use server'

import { db } from '@/db'
import { users, userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'

/**
 * Permanently deletes the authenticated user's own account.
 *
 * FK CASCADE on `users.id` automatically removes: sessions, accounts,
 * userProfiles, userBilling, books (and their binder/chapter children),
 * hive memberships, sparks, comments, likes, follows, notifications, and
 * all other user-owned data.
 *
 * After this returns success the client should navigate to `/sign-in`.
 * The session cookie becomes stale on the next request because the sessions
 * row was cascade-deleted, so the user is effectively signed out everywhere.
 */
export async function deleteOwnAccountAction(): Promise<{
  success: boolean
  error?: string
}> {
  const userId = await requireAuth()

  // Cancel any active Stripe subscription so we don't charge a deleted user.
  // Best-effort: if Stripe is not configured or unavailable, proceed anyway.
  try {
    const billing = await db.query.userBilling.findFirst({
      where: eq(userBilling.userId, userId),
      columns: { stripeSubscriptionId: true, subscriptionStatus: true },
    })
    if (
      billing?.stripeSubscriptionId &&
      billing.subscriptionStatus &&
      ['active', 'trialing', 'past_due'].includes(billing.subscriptionStatus)
    ) {
      // Dynamic import so missing STRIPE_SECRET_KEY doesn't break the action.
      const { stripe } = await import('@/lib/stripe/client')
      await stripe.subscriptions.cancel(billing.stripeSubscriptionId)
    }
  } catch {
    // Non-fatal: proceed with deletion even if Stripe cancellation fails.
  }

  // Cascade delete — all FK constraints on `users.id` (WITH CASCADE DELETE)
  // handle the rest of the cleanup automatically.
  await db.delete(users).where(eq(users.id, userId))

  return { success: true }
}
