# P8A — Stripe Monetization Foundations Design Spec

> **Date:** 2026-05-27
> **Sub-project:** Phase 8A — first of four Phase 8 sub-projects.
> **Status:** Design approved; pending implementation plan.

---

## 1. Goal

Land the Stripe infrastructure that P8B (pricing/checkout), P8C (webhooks), and P8D (billing portal) depend on. After P8A, the codebase is ready to take real Stripe traffic. No user-visible UI ships; no live checkout flow; the webhook endpoint exists but is a no-op. Pure plumbing.

## 2. Context

Beehive Studio has a `userBilling` table with a single `premium: boolean` column. `lib/premium.ts` reads it. Premium-gated features (snapshots, publishing details) check via `getUserPremiumStatus()`. No Stripe SDK is installed yet. The `/pricing` page referenced by upsell CTAs is a 404.

Phase 8 is decomposed into 4 sub-projects:
- **P8A — Foundations** (this spec): SDK install, env vars, schema migration, webhook scaffold, server actions for checkout + billing portal.
- P8B — Pricing page + checkout flow.
- P8C — Webhooks + entitlement (wires the handler logic, audits premium gating).
- P8D — Billing portal + downgrade UX.

Locked decisions from the brainstorm:
1. **Schema:** derive premium from `subscriptionStatus`, drop the `premium: boolean` column.
2. **Env naming:** `STRIPE_*` standard + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
3. **Pricing model:** monthly + annual price IDs.
4. **Customer creation:** lazy on first checkout.
5. **Webhook path:** `/api/webhooks/stripe`.
6. **`DEV_FORCE_PREMIUM`:** kept as a higher-priority short-circuit.
7. **SDK pinning:** npm version pinned AND `apiVersion` pinned in the Stripe client.
8. **Key management:** env-scoped (`.env.local` test keys, Vercel prod env live keys) + runtime prefix sanity check (`sk_live_` in prod, `sk_test_` in dev).

## 3. Non-goals

- UI work: no pricing page, no Settings billing tab, no upsell modal. All UI ships in P8B-P8D.
- Webhook handler logic: scaffold only — `/api/webhooks/stripe` returns 200 for valid signatures, no-op otherwise. P8C wires actual entitlement logic.
- Auditing existing premium-gated server actions: P8C handles that.
- Promo codes, free trials, multiple tiers, tax handling, dunning emails — all out of MVP scope.
- Tests for Stripe integration code. Stripe SDK has its own; our handlers are thin wrappers. Manual verification only.
- Backfill of existing `premium: true` users into `subscriptionStatus`. Confirm during impl that there are no such users (likely true — `premium` was only ever flipped via `DEV_FORCE_PREMIUM` env override).

## 4. Architecture

### 4.1 Schema migration

Extend `userBilling` (whichever schema file contains it — likely `db/schema/users.ts`):

```ts
// Drop:
//   premium: boolean

// Add:
stripeCustomerId: text('stripe_customer_id'),
stripeSubscriptionId: text('stripe_subscription_id'),
subscriptionStatus: subscriptionStatusEnum('subscription_status'),
currentPeriodEnd: timestamp('current_period_end'),
```

New enum:
```ts
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
])
```

All four new columns are nullable. A user with no subscription has all four = `NULL`.

Apply via `npm run db:push` (project pattern).

### 4.2 Premium derivation

`lib/premium.ts` refactored:

```ts
import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const FREE_BOOK_LIMIT = 3
export const FREE_HIVE_LIMIT = 3
export const FREE_HIVE_MEMBER_LIMIT = 5

const PREMIUM_STATUSES = new Set(['active', 'trialing'])

export async function getUserPremiumStatus(userId: string): Promise<boolean> {
  // Dev override — short-circuits real DB read. Guarded to non-prod.
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_FORCE_PREMIUM === 'true') {
    return true
  }

  const billing = await db.query.userBilling.findFirst({
    where: eq(userBilling.userId, userId),
    columns: { subscriptionStatus: true },
  })
  return billing?.subscriptionStatus ? PREMIUM_STATUSES.has(billing.subscriptionStatus) : false
}

// Limit helpers + requirePremium unchanged.
```

The `premium: boolean` column reads are gone. Callers of `getUserPremiumStatus()` are unaffected (same return type).

### 4.3 Stripe client singleton

`lib/stripe/client.ts`:

```ts
import Stripe from 'stripe'

const API_VERSION = '2025-08-27.basil' // Pin to a specific version. Update intentionally.

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  throw new Error('STRIPE_SECRET_KEY is not set. Configure .env.local for dev or Vercel for prod.')
}

// Runtime sanity check — prevent test keys in prod / live keys in dev.
if (process.env.NODE_ENV === 'production' && !key.startsWith('sk_live_')) {
  throw new Error('STRIPE_SECRET_KEY in production must start with sk_live_')
}
if (process.env.NODE_ENV !== 'production' && !key.startsWith('sk_test_')) {
  throw new Error('STRIPE_SECRET_KEY in non-production must start with sk_test_')
}

export const stripe = new Stripe(key, { apiVersion: API_VERSION })
```

Confirm latest `apiVersion` during implementation by checking the `stripe` npm package docs at install time. Pin to the version current at install — comment it.

### 4.4 Server actions

`lib/actions/billing.actions.ts` (new file):

```ts
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

  // Upsert userBilling row with the new customerId.
  await db
    .insert(userBilling)
    .values({ userId, stripeCustomerId: customer.id })
    .onConflictDoUpdate({
      target: userBilling.userId,
      set: { stripeCustomerId: customer.id },
    })

  return customer.id
}

export async function createCheckoutSessionAction(args: {
  priceKey: PriceKey
  locale: string
}): Promise<ActionResult<{ url: string }>> {
  const userId = await requireAuth()
  const priceId = PRICE_IDS[args.priceKey]
  if (!priceId) {
    return { success: false, error: `Stripe price ID not configured for ${args.priceKey}` }
  }

  // Need user email — fetch from users table (or session).
  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { email: true },
  })
  if (!user?.email) return { success: false, error: 'User email not found' }

  const customerId = await ensureStripeCustomer(userId, user.email)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/${args.locale}/settings/billing?checkout=success`,
    cancel_url:  `${baseUrl}/${args.locale}/pricing?checkout=cancel`,
    allow_promotion_codes: true,
    client_reference_id: userId,
  })

  if (!session.url) return { success: false, error: 'Failed to create checkout session' }
  return { success: true, data: { url: session.url } }
}

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

  return { success: true, data: { url: session.url } }
}
```

Notes:
- `NEXT_PUBLIC_APP_URL` is the user-facing base URL (e.g., `https://beehive.studio` in prod, `http://localhost:3000` in dev). Add to env vars in this spec.
- `allow_promotion_codes: true` even though P8A doesn't ship promo codes — saves a Checkout config flip later if Stripe dashboard codes get added.
- Success URL points to `/settings/billing` which doesn't exist yet (P8D ships it). For P8A, both endpoints' return URLs are placeholders that won't actually be navigated to until P8B exposes a way to invoke checkout. Verifying manually means opening the Stripe URL directly.

### 4.5 Webhook endpoint scaffold

`app/api/webhooks/stripe/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: `Signature verification failed: ${message}` }, { status: 400 })
  }

  // Scaffold only — P8C wires the actual handlers.
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'invoice.paid':
    case 'invoice.payment_failed':
      console.log(`[stripe webhook] received ${event.type} (no-op until P8C wires handlers)`)
      break
    default:
      console.log(`[stripe webhook] ignored ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
```

Must use the raw request body for signature verification — `req.text()` not `req.json()`.

### 4.6 Environment variables

Add to `.env.local` (or whatever file the project uses for dev env) AND document in `.env.example`:

```bash
# Stripe — see https://stripe.com/docs/keys
STRIPE_SECRET_KEY=sk_test_xxx                    # server-only
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx   # client-exposed
STRIPE_WEBHOOK_SECRET=whsec_xxx                  # from Stripe CLI for dev, dashboard for prod
STRIPE_PRICE_ID_MONTHLY=price_xxx                # Stripe dashboard → Products → monthly price
STRIPE_PRICE_ID_ANNUAL=price_xxx                 # Stripe dashboard → Products → annual price
NEXT_PUBLIC_APP_URL=http://localhost:3000        # used in success/cancel URLs + portal returns
```

Production env: same variables, live keys (`sk_live_`, `pk_live_`), webhook secret from the Stripe dashboard's production webhook endpoint, prod APP_URL.

Stripe Products to create (one-time, manual in Stripe dashboard):
- "Beehive Premium" product
  - Recurring price: monthly @ $X.XX
  - Recurring price: annual @ $XX.XX (~17% off)
- Copy both `price_*` IDs into env vars.

## 5. Files

**New:**
- `lib/stripe/client.ts`
- `lib/stripe/types.ts` (if needed for shared types; may be empty in P8A and grow in P8C)
- `lib/actions/billing.actions.ts`
- `app/api/webhooks/stripe/route.ts`
- `.env.example` (if not present)

**Modified:**
- `db/schema/users.ts` (or wherever `userBilling` is defined) — extend columns + add enum
- `lib/premium.ts` — refactor `getUserPremiumStatus`
- `package.json` — add `stripe` dependency
- `.env.local` — Chris adds locally (not committed)

## 6. Testing (manual)

1. `npm install stripe` runs cleanly; package added to package.json.
2. `npm run db:push` applies migration; new columns + dropped column visible in Neon dashboard. Enum `subscription_status` created.
3. `npx tsc --noEmit` clean.
4. `npm test` clean (still 119 — no new unit tests).
5. Add test-mode env vars to `.env.local`. Restart dev.
6. Verify dev boots cleanly. If keys missing or wrong prefix, startup throws a clear error.
7. Trigger `createCheckoutSessionAction({ priceKey: 'monthly' })` from a server-action context (e.g., temp debug button or `curl` to a route handler that invokes it). Action returns `{ success: true, data: { url: 'https://checkout.stripe.com/...' } }`.
8. Open the returned URL in a browser. Stripe-hosted checkout page renders.
9. Check `userBilling` row for the test user — `stripeCustomerId` is now populated.
10. Send a POST to `/api/webhooks/stripe` without the `stripe-signature` header → 400.
11. Use Stripe CLI (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`) and trigger `stripe trigger customer.subscription.created`. Endpoint returns 200; server log shows the no-op message.

## 7. Definition of Done

- 5 atomic commits (estimated: schema + client + premium refactor + actions + webhook).
- All 11 manual checks pass.
- `npx tsc --noEmit` clean.
- `npm test` clean (still 119).
- Stripe test mode fully wired in dev.
- Vercel prod env vars set (BUT webhook NOT yet configured in Stripe dashboard — P8C closes that).
- `lib/premium.ts` reads from `subscriptionStatus`; `premium` column dropped.
- AGENTS.md Resume Here updated; P8A entry under "What Has Been Built".
- Pushed to origin/main.

## 8. Risks

1. **Schema migration drops `premium` boolean.** Existing `premium=true` users lose entitlement. Likely zero such users (only `DEV_FORCE_PREMIUM` flipped it in practice). Confirm during impl: `SELECT count(*) FROM user_billing WHERE premium = true` — if non-zero, manually set their `subscriptionStatus = 'active'` before dropping the column.
2. **`apiVersion` pinning.** Future upgrades require coordinated changes in the webhook handler (P8C). Comment in `lib/stripe/client.ts` documents when the pin was set.
3. **Runtime key-prefix check refuses to start.** Misconfigured prod env = deploy failure. Better than silently using test keys in prod. Document in client.ts.
4. **Customer ID orphans.** If a user deletes their account, their Stripe customer remains in Stripe (no automatic cleanup). Acceptable — Stripe doesn't bill unused customers. Future cleanup job can be added.
5. **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` unused in P8A.** Defined for future use (Stripe.js client elements if added later). No risk; just preparation.
6. **Webhook endpoint scaffolded but no-ops.** If Stripe dashboard webhook URL is configured before P8C ships, real events get returned-200 → Stripe stops retrying → those events are LOST. DO NOT configure the dashboard webhook until P8C closes. Documented in spec.

## 9. Next sub-projects (informational)

- **P8B:** Public `/pricing` page (Comfortaa display + Newsreader body, matches DP design system). CTAs invoke `createCheckoutSessionAction` for monthly + annual. Success page on return.
- **P8C:** Real webhook handler logic — sync `subscriptionStatus`, `currentPeriodEnd`, `stripeSubscriptionId`. Idempotency via Stripe event ID dedupe. Audit existing premium-gated server actions for correctness.
- **P8D:** Settings → Billing page wired to `createBillingPortalSessionAction`. Downgrade soft-lock behavior when premium loss pushes user >3 books or >3 hives.
