import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { stripe } from './client'

/**
 * Shared subscription -> userBilling sync layer.
 *
 * Two callers depend on this module:
 *  1. The Stripe webhook (lib/stripe/handle-subscription-event.ts) — the source
 *     of truth for ongoing lifecycle (renewals, cancellations, card failures).
 *  2. Server-side reconciliation (lib/actions/billing.actions.ts) — runs on the
 *     /welcome success page and on a manual "Refresh from Stripe" action, so the
 *     critical upgrade moment does NOT depend on the webhook being configured
 *     and reachable. This is what makes checkout work even before a webhook
 *     endpoint exists (fresh Vercel deploy) or when `stripe listen` isn't
 *     running in local dev.
 */

const KNOWN_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
] as const

export type KnownSubscriptionStatus = (typeof KNOWN_STATUSES)[number]

const KNOWN_STATUS_SET = new Set<string>(KNOWN_STATUSES)

export function isKnownStatus(s: string): s is KnownSubscriptionStatus {
  return KNOWN_STATUS_SET.has(s)
}

/** Statuses that grant premium access (mirrors PREMIUM_STATUSES in lib/premium.ts). */
const PREMIUM_STATUS_SET = new Set<string>(['active', 'trialing', 'past_due'])

export function statusGrantsPremium(status: string | null | undefined): boolean {
  return status ? PREMIUM_STATUS_SET.has(status) : false
}

/**
 * Reads the subscription's current period end as a Date, tolerating both API
 * version shapes (root field on basil and earlier, per-item field on clover and
 * later). Returns null when absent or non-numeric so a bad value never becomes
 * an Invalid Date (which would throw on DB insert and 500 the webhook).
 */
export function extractPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const rootEnd = (subscription as unknown as { current_period_end?: number })
    .current_period_end
  const itemEnd = subscription.items?.data?.[0]?.current_period_end
  const unix = typeof itemEnd === 'number' ? itemEnd : rootEnd
  if (typeof unix !== 'number' || !Number.isFinite(unix)) return null
  return new Date(unix * 1000)
}

function customerIdOf(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id
}

/**
 * Upserts userBilling to mirror the given subscription's current state.
 * Idempotent — repeated calls with the same subscription converge to the same
 * row, so Stripe webhook retries and reconciliation overlap are safe.
 *
 * Throws on an unknown subscription status (Stripe added a value our enum
 * doesn't know) so we never write a value the DB enum rejects.
 */
export async function upsertUserBillingFromSubscription(
  userId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = customerIdOf(subscription)

  if (!isKnownStatus(subscription.status)) {
    throw new Error(
      `Unknown subscription status "${subscription.status}" for customer ${customerId}`,
    )
  }

  const periodEnd = extractPeriodEnd(subscription)

  await db
    .insert(userBilling)
    .values({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: periodEnd,
    })
    .onConflictDoUpdate({
      target: userBilling.userId,
      set: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        currentPeriodEnd: periodEnd,
      },
    })

  console.log(
    `[stripe sync] userBilling set subscriptionStatus=${subscription.status} for user=${userId} (customer=${customerId})`,
  )
}

/**
 * Resolves the app userId for a Stripe customer id. Prefers the stored
 * userBilling mapping; falls back to the customer's metadata.userId (set at
 * customer-creation time in ensureStripeCustomer) when no row exists yet — the
 * race where a webhook arrives before the billing row committed.
 *
 * Throws when the customer is deleted or carries no userId metadata.
 */
export async function resolveUserIdForCustomer(customerId: string): Promise<string> {
  const existing = await db.query.userBilling.findFirst({
    where: eq(userBilling.stripeCustomerId, customerId),
    columns: { userId: true },
  })
  if (existing) return existing.userId

  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) {
    throw new Error(
      `Cannot recover userBilling for deleted Stripe customer ${customerId}`,
    )
  }
  const metaUserId = customer.metadata?.userId
  if (!metaUserId) {
    throw new Error(
      `Stripe customer ${customerId} missing metadata.userId — cannot recover`,
    )
  }
  return metaUserId
}

/**
 * Webhook entry point: resolves the userId from the subscription's customer,
 * then upserts userBilling. Used by handle-subscription-event.ts.
 */
export async function syncSubscriptionToBilling(
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId = await resolveUserIdForCustomer(customerIdOf(subscription))
  await upsertUserBillingFromSubscription(userId, subscription)
}
