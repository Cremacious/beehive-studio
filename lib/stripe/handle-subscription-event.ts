import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { stripe } from './client'

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

type KnownStatus = (typeof KNOWN_STATUSES)[number]

const KNOWN_STATUS_SET = new Set<string>(KNOWN_STATUSES)

function isKnownStatus(s: string): s is KnownStatus {
  return KNOWN_STATUS_SET.has(s)
}

/**
 * Reads the subscription's current period end as a Date, tolerating both API
 * version shapes (root field on basil and earlier, per-item field on clover and
 * later). Returns null when absent or non-numeric so a bad value never becomes
 * an Invalid Date (which would throw on DB insert and 500 the webhook).
 */
function extractPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const rootEnd = (subscription as unknown as { current_period_end?: number })
    .current_period_end
  const itemEnd = subscription.items?.data?.[0]?.current_period_end
  const unix = typeof itemEnd === 'number' ? itemEnd : rootEnd
  if (typeof unix !== 'number' || !Number.isFinite(unix)) return null
  return new Date(unix * 1000)
}

/**
 * Handles customer.subscription.{created,updated,deleted} events.
 *
 * Idempotent by construction — every call upserts userBilling to the
 * subscription's current state, so repeated Stripe retries are safe.
 *
 * DO NOT add side effects (welcome emails, bonus grants) without first
 * adding event-id deduplication. Stripe retries the same event multiple
 * times on transient errors; side effects would re-fire.
 *
 * On userBilling row missing (race condition where webhook arrives before
 * ensureStripeCustomer committed), fetches the Stripe customer to recover
 * the userId from metadata.userId, then upserts.
 *
 * Throws on hard failures (missing metadata.userId, unknown status, DB
 * outage). The webhook route returns 500 on throw so Stripe retries.
 */
export async function handleSubscriptionEvent(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  if (!isKnownStatus(subscription.status)) {
    throw new Error(
      `Unknown subscription status "${subscription.status}" for customer ${customerId}`,
    )
  }

  // Look up userBilling by stripeCustomerId.
  const existing = await db.query.userBilling.findFirst({
    where: eq(userBilling.stripeCustomerId, customerId),
    columns: { userId: true },
  })

  let userId: string
  if (existing) {
    userId = existing.userId
  } else {
    // Race recovery: fetch the Stripe customer for the userId metadata.
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
    userId = metaUserId
  }

  // current_period_end location depends on the account's API version:
  //  - <= 2025-08-27.basil: on the Subscription root
  //  - >= 2026-02-25.clover: on each subscription item
  // The pinned SDK version does not control how webhook events are serialized
  // (they arrive in the account's default version), so read whichever field is
  // present and guard against missing/NaN so an Invalid Date never throws on
  // insert (which would 500 the webhook and silently block entitlement).
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
    `[stripe webhook] userBilling set subscriptionStatus=${subscription.status} for user=${userId} (customer=${customerId})`,
  )
}
