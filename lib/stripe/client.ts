import Stripe from 'stripe'

// Pinned API version. Matches the SDK's declared LatestApiVersion at install
// time (stripe@20.4.1 → '2026-02-25.clover'). When upgrading: bump here AND
// verify webhook event shapes in P8C handlers haven't changed for the events
// we handle.
const API_VERSION = '2026-02-25.clover'

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  throw new Error(
    'STRIPE_SECRET_KEY is not set. Configure .env.local for dev or Vercel for prod.',
  )
}

// Runtime sanity check — fail loud if test keys leak to prod or vice versa.
if (process.env.NODE_ENV === 'production' && !key.startsWith('sk_live_')) {
  throw new Error('STRIPE_SECRET_KEY in production must start with sk_live_')
}
if (process.env.NODE_ENV !== 'production' && !key.startsWith('sk_test_')) {
  throw new Error('STRIPE_SECRET_KEY in non-production must start with sk_test_')
}

export const stripe = new Stripe(key, {
  apiVersion: API_VERSION as Stripe.LatestApiVersion,
})
