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

// Validate the key is a real Stripe secret key shape.
const isLiveKey = key.startsWith('sk_live_')
const isTestKey = key.startsWith('sk_test_')
if (!isLiveKey && !isTestKey) {
  throw new Error('STRIPE_SECRET_KEY must start with sk_live_ or sk_test_')
}

// Going-live guard (opt-in). Vercel runs EVERY deploy — production, preview,
// and alpha — with NODE_ENV=production, so we can't key "must be live" off
// NODE_ENV or test-mode deploys would fail to build. Instead, set
// STRIPE_REQUIRE_LIVE=true in Vercel when you switch from the Stripe sandbox to
// real payments; until then test keys are accepted everywhere so the app stays
// deployable in alpha.
if (process.env.STRIPE_REQUIRE_LIVE === 'true' && !isLiveKey) {
  throw new Error(
    'STRIPE_REQUIRE_LIVE=true but STRIPE_SECRET_KEY is a test key. Use an sk_live_ key, or unset STRIPE_REQUIRE_LIVE.',
  )
}

// Guard against a live key leaking into local dev (real cards). Never fires
// during a Vercel build, where NODE_ENV is always production.
if (process.env.NODE_ENV !== 'production' && isLiveKey) {
  throw new Error('A live STRIPE_SECRET_KEY (sk_live_) must not be used in a non-production environment.')
}

export const stripe = new Stripe(key, {
  apiVersion: API_VERSION as Stripe.LatestApiVersion,
})
