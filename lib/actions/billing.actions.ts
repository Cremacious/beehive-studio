'use server'

import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '@/lib/require-auth'
import { stripe } from '@/lib/stripe/client'
import type { ActionResult } from './book.actions'

const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_ID_MONTHLY,
  annual: process.env.STRIPE_PRICE_ID_ANNUAL,
} as const

type PriceKey = keyof typeof PRICE_IDS

/**
 * Ensures the user has a Stripe customer record. Creates one on first call
 * (lazy creation pattern); returns the existing ID on subsequent calls.
 */
async function ensureStripeCustomer(userId: string, userEmail: string): Promise<string> {
  const billing = await db.query.userBilling.findFirst({
    where: eq(userBilling.userId, userId),
    columns: { stripeCustomerId: true },
  })
  if (billing?.stripeCustomerId) return billing.stripeCustomerId

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
    success_url: `${baseUrl}/${args.locale}/settings/billing?checkout=success`,
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
