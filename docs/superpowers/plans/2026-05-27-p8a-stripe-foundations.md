# P8A Stripe Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the Stripe infrastructure (SDK, env vars, schema, client singleton, server actions, webhook scaffold) so P8B-D can build user-facing flows on it. After P8A, the codebase takes real Stripe traffic but no UI is wired and the webhook is a no-op.

**Architecture:** Five atomic tasks executed in order. Schema first (everything else depends on it). Then SDK + client. Then `lib/premium.ts` refactor. Then the two billing server actions. Then the webhook endpoint scaffold. Final task closes out with AGENTS.md + push.

**Tech Stack:** Next.js 16 App Router (Route Handlers for the webhook), Drizzle ORM + Neon Postgres (`npm run db:push`), Stripe SDK (`stripe` npm package, pinned `apiVersion`).

**Spec:** [`docs/superpowers/specs/2026-05-27-p8a-stripe-foundations-design.md`](../specs/2026-05-27-p8a-stripe-foundations-design.md)

---

## File Structure

**New:**
- `lib/stripe/client.ts`
- `lib/stripe/types.ts` (may be empty in P8A; placeholder for P8C shared types)
- `lib/actions/billing.actions.ts`
- `app/api/webhooks/stripe/route.ts`
- `.env.example` (if not present)

**Modified:**
- `db/schema/users.ts` (or wherever `userBilling` is defined — confirm during Task 1)
- `lib/premium.ts`
- `package.json` (Stripe dependency added by `npm install`)
- `.env.local` (Chris edits locally — not in git)

**No new tests required.** Stripe SDK is third-party; our handlers are thin wrappers. Manual verification per task.

**DB:** schema change applied via `npm run db:push`, not generate+migrate (per project convention).

---

## Task 1: Schema migration

**Files:**
- Modify: `db/schema/users.ts` (confirm path during Step 1)

- [ ] **Step 1: Find userBilling**

```bash
grep -rn "userBilling\|user_billing" db/schema/ 2>&1 | head -5
```

Find the schema file that defines `userBilling`. Read it fully to understand the existing columns (`userId`, `premium`, etc.) and adjacent tables.

- [ ] **Step 2: Check existing data**

Before dropping `premium`, confirm no real users depend on it:

```sql
SELECT count(*) FROM user_billing WHERE premium = true;
```

(Use `npx drizzle-kit studio` or query the Neon dashboard.)

- If 0 rows: drop cleanly (the typical case — `premium` was only ever flipped via `DEV_FORCE_PREMIUM`).
- If N > 0 rows: tell Chris. Don't proceed silently. Likely need to migrate them to `subscriptionStatus = 'active'` first (or accept the loss with his consent).

- [ ] **Step 3: Add the enum**

In the schema file, near the top with other enum definitions, add:

```ts
import { pgEnum, text, timestamp } from 'drizzle-orm/pg-core'

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

(Add only the imports that aren't already present.)

- [ ] **Step 4: Extend userBilling table definition**

In the existing `userBilling` table definition:

- Remove the `premium: boolean(...)` column.
- Add four new columns:

```ts
stripeCustomerId: text('stripe_customer_id'),
stripeSubscriptionId: text('stripe_subscription_id'),
subscriptionStatus: subscriptionStatusEnum('subscription_status'),
currentPeriodEnd: timestamp('current_period_end'),
```

All four are nullable (no `.notNull()`).

- [ ] **Step 5: Apply migration**

```bash
npm run db:push
```

Expect prompts about dropping `premium` column and adding the new ones + enum. Confirm.

Verify via Neon dashboard: `user_billing` has new columns, enum `subscription_status` exists, `premium` column gone.

- [ ] **Step 6: Type check + tests**

```bash
npx tsc --noEmit
npm test
```

Both clean. **EXPECTED:** `lib/premium.ts` may now error because it reads the dropped `premium` column. Task 3 fixes that. For now, leave the tsc error — note in commit message it's expected and will be cleared by Task 3.

Actually, if tsc errors block downstream tasks, fix `lib/premium.ts` minimally here (just enough to compile — Task 3 does the full refactor). Easiest: comment out the `.findFirst({ columns: { premium: true }})` line and return `false` temporarily. Re-evaluate during impl.

- [ ] **Step 7: Commit**

```bash
git add db/schema/
git commit -m "feat(db): extend userBilling for Stripe; drop premium boolean (P8A Task 1)

Adds stripeCustomerId, stripeSubscriptionId, subscriptionStatus (enum),
currentPeriodEnd. Drops the premium boolean — entitlement now derives
from subscriptionStatus IN ('active', 'trialing') via getUserPremiumStatus
(refactored in Task 3).

Applied via npm run db:push. No data migration needed (premium column
had no real-user data — only DEV_FORCE_PREMIUM flipped it in practice)."
```

---

## Task 2: Stripe SDK + client singleton

**Files:**
- Modify: `package.json` (via `npm install`)
- Create: `lib/stripe/client.ts`
- Create: `lib/stripe/types.ts` (placeholder)

- [ ] **Step 1: Install Stripe SDK**

```bash
npm install stripe
```

Note the version in `package.json` after install. Document in `client.ts` comment.

- [ ] **Step 2: Pick apiVersion**

Open `node_modules/stripe/types/index.d.ts` or check Stripe docs at install time for the current `apiVersion` string (looks like `'2025-XX-XX.basil'`). Use the version that matches the SDK's declared types.

Example: `'2025-08-27.basil'` (verify at install time — Stripe pins the SDK to a specific dated version).

- [ ] **Step 3: Create the client**

```ts
// lib/stripe/client.ts
import Stripe from 'stripe'

// Pinned API version. When upgrading: bump here AND verify webhook event
// shapes in P8C handlers haven't changed for the events we handle.
const API_VERSION = '2025-08-27.basil' // ← use whatever's current at install time

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  throw new Error('STRIPE_SECRET_KEY is not set. Configure .env.local for dev or Vercel for prod.')
}

// Runtime sanity check — fail loud if test keys leak to prod or vice versa.
if (process.env.NODE_ENV === 'production' && !key.startsWith('sk_live_')) {
  throw new Error('STRIPE_SECRET_KEY in production must start with sk_live_')
}
if (process.env.NODE_ENV !== 'production' && !key.startsWith('sk_test_')) {
  throw new Error('STRIPE_SECRET_KEY in non-production must start with sk_test_')
}

export const stripe = new Stripe(key, { apiVersion: API_VERSION })
```

If the TS compiler complains about the `apiVersion` string type, cast: `apiVersion: API_VERSION as Stripe.LatestApiVersion`. Confirm during impl.

- [ ] **Step 4: Create the types placeholder**

```ts
// lib/stripe/types.ts
// Reserved for shared Stripe-related types added in P8C
// (e.g., subscription-event payload narrowing helpers).
export {}
```

- [ ] **Step 5: Local sanity check**

Without env vars set, the `client.ts` import would throw. So don't import it from anywhere yet. Type-check only:

```bash
npx tsc --noEmit
```

If clean, the SDK types resolved and the module compiles.

- [ ] **Step 6: Commit**

```bash
git add lib/stripe/ package.json package-lock.json
git commit -m "feat(stripe): Stripe SDK + pinned client singleton (P8A Task 2)

Installs the stripe npm package and creates lib/stripe/client.ts with:
- Pinned apiVersion (matches SDK at install time)
- Runtime sanity check on STRIPE_SECRET_KEY prefix
  (sk_live_ required in prod, sk_test_ required in dev)
- Single exported `stripe` singleton for all server-side use

lib/stripe/types.ts is a placeholder for P8C's shared types."
```

---

## Task 3: Refactor lib/premium.ts

**Files:**
- Modify: `lib/premium.ts`

- [ ] **Step 1: Read current file**

Read `lib/premium.ts`. Note:
- `getUserPremiumStatus(userId)` returns boolean.
- `requirePremium()` helper.
- `DEV_FORCE_PREMIUM` env override.
- Free-tier constants (`FREE_BOOK_LIMIT`, etc.).
- Any other helpers used elsewhere — grep `import.*premium`:

```bash
grep -rn "from '@/lib/premium'" "app/" "lib/" 2>&1
```

Confirm signature stays identical so callers don't break.

- [ ] **Step 2: Rewrite getUserPremiumStatus**

```ts
import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const FREE_BOOK_LIMIT = 3
export const FREE_HIVE_LIMIT = 3
export const FREE_HIVE_MEMBER_LIMIT = 5

const PREMIUM_STATUSES = new Set(['active', 'trialing'])

/**
 * Returns true if the user currently has an active or trialing subscription.
 *
 * Dev override: if NODE_ENV !== 'production' AND DEV_FORCE_PREMIUM === 'true',
 * returns true without a DB read. Used for local UI testing without setting
 * up a Stripe test customer.
 */
export async function getUserPremiumStatus(userId: string): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_FORCE_PREMIUM === 'true') {
    return true
  }

  const billing = await db.query.userBilling.findFirst({
    where: eq(userBilling.userId, userId),
    columns: { subscriptionStatus: true },
  })

  return billing?.subscriptionStatus ? PREMIUM_STATUSES.has(billing.subscriptionStatus) : false
}

/**
 * Throws if the user is not premium. Used in server actions that gate
 * premium-only features.
 */
export async function requirePremium(userId: string): Promise<void> {
  const isPremium = await getUserPremiumStatus(userId)
  if (!isPremium) {
    throw new Error('PREMIUM_REQUIRED')
  }
}
```

Preserve everything else verbatim (limits, any other exports).

- [ ] **Step 3: Type check + tests**

```bash
npx tsc --noEmit
npm test
```

Both clean. If `premium` is referenced anywhere else (e.g., a query elsewhere that columns:`{premium: true}`), tsc catches it. Fix any straggler that broke.

- [ ] **Step 4: Commit**

```bash
git add lib/premium.ts
git commit -m "refactor(premium): derive entitlement from subscriptionStatus (P8A Task 3)

getUserPremiumStatus now reads subscriptionStatus and returns true only
when status is 'active' or 'trialing'. The premium boolean column was
dropped in Task 1; no fallback path remains.

DEV_FORCE_PREMIUM env override preserved (short-circuits before DB read,
guarded to non-production builds).

Existing callers unaffected — signature unchanged."
```

---

## Task 4: Billing server actions

**Files:**
- Create: `lib/actions/billing.actions.ts`

- [ ] **Step 1: Read existing action pattern**

Look at `lib/actions/book.actions.ts` or similar to confirm:
- `'use server'` directive style.
- `ActionResult<T>` shape: `{ success: true; data: T } | { success: false; error: string }`.
- `requireAuth()` import path (likely `@/lib/require-auth`).
- How user email is fetched (from `users` table via `userId`).

- [ ] **Step 2: Write billing.actions.ts**

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

  // Look up user email via the users table.
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

  return { success: true, data: { url: session.url } }
}
```

Confirm `ActionResult` import path during impl. Some projects export it from a shared `lib/actions/_types.ts`; this one likely re-exports via `book.actions.ts`.

If the `users` table doesn't have an `email` column directly (e.g., better-auth stores it differently), adjust the lookup. Use whatever pattern existing actions use to read user email.

- [ ] **Step 3: Type check + tests**

```bash
npx tsc --noEmit
npm test
```

Both clean.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/billing.actions.ts
git commit -m "feat(billing): createCheckoutSession + createBillingPortalSession actions (P8A Task 4)

Two server actions in lib/actions/billing.actions.ts:

createCheckoutSessionAction({ priceKey, locale })
- Ensures user has a Stripe customer (lazy creation on first call;
  customer.metadata.userId for webhook reconciliation in P8C).
- Creates a subscription-mode Checkout Session with the configured
  price ID (monthly or annual).
- Returns the Stripe-hosted Checkout URL.

createBillingPortalSessionAction({ locale })
- Creates a Billing Portal session for the user's existing Stripe
  customer.
- Returns the portal URL.
- Returns error if no customer exists (P8D handles UX of 'subscribe first').

No UI consumer yet; P8B wires the pricing page to createCheckoutSession,
P8D wires Settings to createBillingPortalSession."
```

---

## Task 5: Webhook endpoint scaffold + AGENTS.md + push

**Files:**
- Create: `app/api/webhooks/stripe/route.ts`
- Create: `.env.example` (if not present)
- Modify: `AGENTS.md`

- [ ] **Step 1: Confirm Next.js route handler conventions**

Look at `app/api/auth/[...all]/route.ts` (better-auth route handler) or `app/api/chapter-save-beacon/route.ts` to confirm:
- Whether the project uses `NextRequest` / `NextResponse` from `next/server`.
- Whether `runtime = 'nodejs'` is explicitly exported anywhere.

Stripe SDK requires Node runtime (Edge runtime doesn't support `crypto.timingSafeEqual` reliably for signature verification). Add `export const runtime = 'nodejs'` at top if the project doesn't default to it.

- [ ] **Step 2: Create the webhook route**

```ts
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import type Stripe from 'stripe'

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
    return NextResponse.json({ error: `Signature verification failed: ${message}` }, { status: 400 })
  }

  // P8A scaffold — log known event types; P8C wires real handlers.
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

- [ ] **Step 3: Create .env.example (if not present)**

```bash
ls .env.example 2>&1
```

If absent, create:

```bash
# Stripe — see https://stripe.com/docs/keys
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_MONTHLY=price_xxx
STRIPE_PRICE_ID_ANNUAL=price_xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

If `.env.example` exists, append the Stripe block.

- [ ] **Step 4: Type check + tests**

```bash
npx tsc --noEmit
npm test
```

Both clean.

- [ ] **Step 5: Manual webhook test (optional but recommended)**

If Chris has Stripe CLI installed:

```bash
# In one terminal:
npm run dev

# In another terminal:
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Then trigger a test event:
stripe trigger customer.subscription.created
```

Expected: dev console logs `[stripe webhook] received customer.subscription.created (no-op until P8C wires handlers)`. Stripe CLI shows 200 response.

If Stripe CLI isn't installed, skip — P8C will require it anyway.

- [ ] **Step 6: Update AGENTS.md**

Read `AGENTS.md`. Update Resume Here:
- Last updated: 2026-05-27
- Current focus: "P8A Foundations complete; P8B Pricing page + checkout flow next."
- Last commit: `git log -1 --format=%s` after AGENTS.md commit
- Next concrete step: "invoke /brainstorming for P8B Pricing page + checkout flow — public /[locale]/pricing page with monthly/annual CTAs invoking createCheckoutSessionAction."

Add a P8A pattern entry to the Key Patterns block:

> **P8A Stripe pattern:** Premium derives from `userBilling.subscriptionStatus IN ('active', 'trialing')` — no denormalized boolean. Stripe customer creation is lazy (first checkout creates the customer; stored on `userBilling.stripeCustomerId`). `lib/stripe/client.ts` is the singleton with pinned `apiVersion` + runtime key-prefix sanity check (`sk_live_` in prod, `sk_test_` in dev). Webhook endpoint at `/api/webhooks/stripe` is signature-verified but no-op in P8A (P8C wires handlers — do NOT configure Stripe dashboard webhook URL until then or events get lost). `DEV_FORCE_PREMIUM=true` env override still works for local testing without Stripe.

Add a P8A entry under "What Has Been Built":

```markdown
### P8A — Stripe Foundations ✅ COMPLETE (2026-05-27)
First of four Phase 8 sub-projects (P8A → P8D). Lands the Stripe infrastructure.

- **Schema:** `userBilling` extended with `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus` (enum), `currentPeriodEnd`. `premium: boolean` dropped — entitlement now derives from `subscriptionStatus IN ('active', 'trialing')` via `getUserPremiumStatus()`.
- **SDK:** `stripe` npm package installed; `lib/stripe/client.ts` is a singleton with pinned `apiVersion` + runtime key-prefix sanity check (fails loud if test key in prod or live key in dev).
- **Server actions:** `createCheckoutSessionAction({ priceKey, locale })` and `createBillingPortalSessionAction({ locale })` in `lib/actions/billing.actions.ts`. Lazy customer creation on first checkout.
- **Webhook scaffold:** `/api/webhooks/stripe` with signature verification + no-op handlers (P8C wires real entitlement sync). DO NOT configure Stripe dashboard webhook URL until P8C ships.
- **Env vars:** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`, `NEXT_PUBLIC_APP_URL` documented in `.env.example`.
- **`DEV_FORCE_PREMIUM=true` preserved** — short-circuits before DB read in non-production builds.

No UI ships in P8A. P8B will build the pricing page; P8C wires real webhook handlers; P8D wires Settings → Billing portal.

**Next:** P8B Pricing page + checkout flow.
```

- [ ] **Step 7: Commit + push**

```bash
git add app/api/webhooks/stripe/route.ts .env.example AGENTS.md
git commit -m "feat(stripe): webhook scaffold + AGENTS.md close-out (P8A Task 5)

POST /api/webhooks/stripe — Stripe signature verification + no-op
handlers (logs known event types). Returns 400 on missing/invalid
signature, 200 on verified events. P8C wires real entitlement
sync logic.

runtime='nodejs' and dynamic='force-dynamic' so signature verification
works (Edge crypto unreliable; raw body required).

WARNING: do NOT configure the Stripe dashboard webhook URL until
P8C ships — current scaffold returns 200 for all events, which
tells Stripe 'received OK, no retry' → events get lost.

.env.example documents Stripe variables for future contributors.

AGENTS.md updated: P8A marked complete; P8B queued.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"

git push origin main
```

---

## Definition of Done

- 5 atomic commits (Tasks 1-5).
- All 11 manual checks pass (from spec §6).
- `npx tsc --noEmit` clean.
- `npm test` clean (still 119).
- Stripe SDK installed; client singleton present with pinned `apiVersion`.
- `userBilling` schema extended; `premium` boolean dropped.
- `lib/premium.ts` reads from `subscriptionStatus`; `DEV_FORCE_PREMIUM` preserved.
- Two billing server actions present; one creates Checkout, one creates Billing Portal.
- Webhook endpoint scaffolded with signature verification.
- AGENTS.md Resume Here updated; P8A entry added.
- Pushed to origin/main.
- Stripe dashboard webhook URL NOT yet configured (deliberate — would lose events until P8C).
