import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import { handleSubscriptionEvent } from '@/lib/stripe/handle-subscription-event'

// Stripe signature verification requires Node runtime crypto.
export const runtime = 'nodejs'

// Tell Next.js NOT to parse the body — we need the raw text for signature
// verification.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown signature error'
    console.error('[stripe webhook] signature verification failed:', message)
    return NextResponse.json(
      { error: `Signature verification failed: ${message}` },
      { status: 400 },
    )
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(event.data.object)
        break
      default:
        console.log(`[stripe webhook] ignored ${event.type}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown handler error'
    console.error(`[stripe webhook] handler error on ${event.type}:`, message)
    // Return 500 so Stripe retries. Most DB issues self-heal. Persistent
    // failures show up in Vercel logs + Stripe retry queue.
    return NextResponse.json(
      { error: `Handler failed: ${message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ received: true })
}
