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

  // In the pinned API version (2026-02-25.clover), current_period_end moved
  // from the Subscription to its items. Read from the first item; all items
  // in a single subscription share the same billing cycle.
  const firstItem = subscription.items.data[0]
  const periodEnd = firstItem
    ? new Date(firstItem.current_period_end * 1000)
    : null

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
}
