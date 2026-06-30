'use server'

import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { stripe } from '@/lib/stripe/client'
import {
  statusGrantsPremium,
  upsertUserBillingFromSubscription,
} from '@/lib/stripe/sync-subscription'
import type { ActionResult } from './book.actions'

const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_ID_MONTHLY,
  annual: process.env.STRIPE_PRICE_ID_ANNUAL,
} as const

type PriceKey = keyof typeof PRICE_IDS

/**
 * Ensures the user has a Stripe customer record. Creates one on first call
 * (lazy creation pattern); returns the existing ID on subsequent calls.
 *
 * Self-heals a dangling customer id: if the stored id no longer resolves in
 * Stripe (deleted, or the account's test data was reset between sessions), a
 * fresh customer is created and persisted. Without this, checkout throws
 * "No such customer" forever for that user.
 */
async function ensureStripeCustomer(userId: string, userEmail: string): Promise<string> {
  const billing = await db.query.userBilling.findFirst({
    where: eq(userBilling.userId, userId),
    columns: { stripeCustomerId: true },
  })

  if (billing?.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(billing.stripeCustomerId)
      if (!existing.deleted) return billing.stripeCustomerId
      // deleted customer -> fall through and recreate
    } catch (err) {
      // 'resource_missing' means the id is dangling -> recreate. Anything else
      // (network, auth) is a real failure and should propagate.
      const code = (err as { code?: string } | null)?.code
      if (code !== 'resource_missing') throw err
    }
  }

  const customer = await stripe.customers.create({
    email: userEmail,
    metadata: { userId },
  })

  await db
    .insert(userBilling)
    .values({ userId, stripeCustomerId: customer.id })
    .onConflictDoUpdate({
      target: userBilling.userId,
      set: { stripeCustomerId: customer.id },
    })

  return customer.id
}

/**
 * Creates a Stripe Checkout Session for a subscription. Returns the URL
 * the client should redirect to.
 */
export async function createCheckoutSessionAction(args: {
  priceKey: PriceKey
  locale: string
}): Promise<ActionResult<{ url: string }>> {
  const userId = await requireAuth()
  const priceId = PRICE_IDS[args.priceKey]
  if (!priceId) {
    return { success: false, error: `Stripe price ID not configured for ${args.priceKey}` }
  }

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { email: true },
  })
  if (!user?.email) {
    return { success: false, error: 'User email not found' }
  }

  const customerId = await ensureStripeCustomer(userId, user.email)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/${args.locale}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/${args.locale}/pricing?checkout=cancel`,
    allow_promotion_codes: true,
    client_reference_id: userId,
  })

  if (!session.url) {
    return { success: false, error: 'Failed to create checkout session' }
  }
  return { success: true, data: { url: session.url } }
}

/**
 * Reconciles a completed Checkout Session into userBilling, server-side.
 *
 * Called from the /welcome success page (where Stripe redirects after payment)
 * so premium entitlement is synced the moment the user lands, independent of
 * whether the Stripe webhook is configured/reachable. The webhook remains the
 * source of truth for later lifecycle events (renewal, cancellation, dunning).
 *
 * Security: only the caller's own checkout session can be reconciled. We set
 * client_reference_id = userId at checkout creation and verify it here, so a
 * user passing someone else's session_id cannot sync another account.
 */
export async function reconcileCheckoutSessionAction(args: {
  sessionId: string
}): Promise<ActionResult<{ premium: boolean }>> {
  const userId = await requireAuth()

  try {
    const checkout = await stripe.checkout.sessions.retrieve(args.sessionId, {
      expand: ['subscription'],
    })

    if (checkout.client_reference_id !== userId) {
      return { success: false, error: 'Checkout session does not belong to this user' }
    }

    const subscription = checkout.subscription
    if (!subscription || typeof subscription === 'string') {
      // Payment succeeded but the subscription is not yet attached/expanded.
      // The webhook is the backstop; report not-yet-premium so the page can
      // show a "activating" message rather than a false celebration.
      return { success: true, data: { premium: false } }
    }

    await upsertUserBillingFromSubscription(userId, subscription)

    return { success: true, data: { premium: statusGrantsPremium(subscription.status) } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not reconcile checkout session'
    console.error('[billing] reconcileCheckoutSession failed:', message)
    return { success: false, error: message }
  }
}

/**
 * Pulls the user's latest Stripe subscription and upserts userBilling from it.
 *
 * A manual fallback for the billing page: covers cases where a portal-driven
 * change (cancel, resubscribe, plan swap) did not reach the app via webhook —
 * most relevant in local dev without `stripe listen`, but also a safe "force
 * refresh" anywhere. Picks the most relevant subscription: an active/trialing/
 * past_due one if present, else the most recently created.
 */
export async function syncMyBillingFromStripeAction(): Promise<
  ActionResult<{ status: string | null }>
> {
  const userId = await requireAuth()

  const billing = await db.query.userBilling.findFirst({
    where: eq(userBilling.userId, userId),
    columns: { stripeCustomerId: true },
  })
  if (!billing?.stripeCustomerId) {
    return { success: false, error: 'No Stripe customer to sync yet' }
  }

  try {
    const subs = await stripe.subscriptions.list({
      customer: billing.stripeCustomerId,
      status: 'all',
      limit: 10,
    })

    if (subs.data.length === 0) {
      return { success: true, data: { status: null } }
    }

    const premiumOne = subs.data.find((s) => statusGrantsPremium(s.status))
    const chosen =
      premiumOne ??
      [...subs.data].sort((a, b) => b.created - a.created)[0]

    await upsertUserBillingFromSubscription(userId, chosen)
    return { success: true, data: { status: chosen.status } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not sync from Stripe'
    console.error('[billing] syncMyBillingFromStripe failed:', message)
    return { success: false, error: message }
  }
}

/**
 * Creates a Stripe Billing Portal session for the current user. Returns the
 * URL the client should redirect to. Returns an error if the user has no
 * Stripe customer yet (i.e., never started a checkout).
 */
export async function createBillingPortalSessionAction(args: {
  locale: string
}): Promise<ActionResult<{ url: string }>> {
  const userId = await requireAuth()

  const billing = await db.query.userBilling.findFirst({
    where: eq(userBilling.userId, userId),
    columns: { stripeCustomerId: true },
  })
  if (!billing?.stripeCustomerId) {
    return { success: false, error: 'No subscription to manage' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: `${baseUrl}/${args.locale}/settings/billing`,
  })

  if (!session.url) {
    return { success: false, error: 'Failed to create billing portal session' }
  }
  return { success: true, data: { url: session.url } }
}
