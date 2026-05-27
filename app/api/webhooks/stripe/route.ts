import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'

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

  // P8A scaffold — log known event types; P8C wires real handlers.
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'invoice.paid':
    case 'invoice.payment_failed':
      console.log(
        `[stripe webhook] received ${event.type} (no-op until P8C wires handlers)`,
      )
      break
    default:
      console.log(`[stripe webhook] ignored ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
