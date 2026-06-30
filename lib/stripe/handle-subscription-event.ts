import type Stripe from 'stripe'
import { syncSubscriptionToBilling } from './sync-subscription'

/**
 * Handles customer.subscription.{created,updated,deleted} events.
 *
 * Thin wrapper over syncSubscriptionToBilling (lib/stripe/sync-subscription.ts).
 * The webhook is the source of truth for ongoing lifecycle (renewals,
 * cancellations, payment failures). The initial upgrade is ALSO reconciled
 * server-side on /welcome, so entitlement never depends solely on this webhook
 * being configured and reachable.
 *
 * Idempotent by construction — every call upserts userBilling to the
 * subscription's current state, so repeated Stripe retries are safe.
 *
 * DO NOT add side effects (welcome emails, bonus grants) here without first
 * adding event-id deduplication. Stripe retries the same event multiple times
 * on transient errors; side effects would re-fire.
 *
 * Throws on hard failures (missing metadata.userId, unknown status, DB outage).
 * The webhook route returns 500 on throw so Stripe retries.
 */
export async function handleSubscriptionEvent(
  subscription: Stripe.Subscription,
): Promise<void> {
  await syncSubscriptionToBilling(subscription)
}
