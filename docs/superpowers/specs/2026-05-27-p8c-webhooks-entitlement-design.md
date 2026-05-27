# P8C — Webhooks + Entitlement Design Spec

> **Date:** 2026-05-27
> **Sub-project:** Phase 8C — third of four Phase 8 sub-projects.
> **Status:** Design approved; pending implementation plan.

---

## 1. Goal

Wire real handler logic into `/api/webhooks/stripe` so subscription state syncs from Stripe events to `userBilling.subscriptionStatus` + `stripeSubscriptionId` + `currentPeriodEnd`. After P8C, paying users actually become premium when Stripe sends events. Audit existing premium-gated server actions for correctness. After P8C deploys, the Stripe dashboard webhook URL can be configured (it must NOT be configured before this ships — P8A scaffold returns 200 for all events without processing them).

## 2. Context

Phase 8 decomposition:
- ✅ P8A Foundations
- ✅ P8B Pricing + Checkout
- **P8C Webhooks + entitlement** (this spec)
- P8D Billing portal + downgrade UX

P8A shipped the webhook scaffold: signature verification + a switch with no-op handlers logging "received {event.type} (no-op until P8C wires handlers)". P8B shipped the checkout flow, so users can complete purchases — but they don't actually become premium because the webhook doesn't act on subscription events.

Locked decisions from the brainstorm:
1. Idempotency via upsert-only handlers; no new event-log table.
2. User lookup by `stripeCustomerId` on `userBilling`.
3. Handle 3 events: `customer.subscription.created` / `updated` / `deleted`.
4. Return 500 on DB errors → Stripe retries for up to 3 days.
5. Full grep audit of `getUserPremiumStatus` callers.
6. Stripe CLI for local testing.
7. (Q7 moot — no idempotency storage needed.)
8. Race recovery: if userBilling row missing, fetch Stripe customer + read metadata.userId + upsert.

## 3. Non-goals

- Invoice events (`invoice.paid`, `invoice.payment_failed`). Subscription events carry all the state we care about for MVP. If/when we add dunning emails, revisit.
- Other subscription-related events (`trial_will_end`, `payment_action_required`, etc.). Out of MVP scope.
- New tables. Upserts are idempotent enough; no event log needed.
- New server actions. Webhook is the only consumer of the new handler function.
- Side effects beyond DB sync (welcome emails, bonus grants). P8C is sync-only. Document this constraint so future work doesn't add side effects without revisiting idempotency.
- Configuring the Stripe dashboard webhook URL. That's a manual post-deploy step Chris does in his Stripe dashboard once this ships.

## 4. Architecture

### 4.1 Handler module

`lib/stripe/handle-subscription-event.ts`:

```ts
import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { stripe } from './client'
import type Stripe from 'stripe'

/**
 * Handles customer.subscription.{created,updated,deleted} events.
 * Idempotent by construction — every call upserts userBilling to the
 * subscription's current state, so repeated Stripe retries are safe.
 *
 * On userBilling row missing (race condition where the webhook arrives
 * before ensureStripeCustomer committed), fetches the Stripe customer
 * to recover the userId from metadata, then upserts.
 *
 * Throws on hard failures (missing metadata.userId, DB outage).
 * The webhook route handler returns 500 on throw so Stripe retries.
 */
export async function handleSubscriptionEvent(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

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
      throw new Error(`Cannot recover userBilling for deleted customer ${customerId}`)
    }
    const metaUserId = customer.metadata?.userId
    if (!metaUserId) {
      throw new Error(`Stripe customer ${customerId} missing metadata.userId — cannot recover`)
    }
    userId = metaUserId
  }

  // Upsert the row. The same payload re-applied = same final state (idempotent).
  await db
    .insert(userBilling)
    .values({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    })
    .onConflictDoUpdate({
      target: userBilling.userId,
      set: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    })
}
```

Notes:
- `subscription.status` matches the `subscriptionStatusEnum` we defined in P8A. TypeScript will catch any mismatch if Stripe SDK types narrow it.
- `subscription.current_period_end` is a Unix timestamp in seconds; convert via `* 1000` for the JS Date.
- The function is the same for create / update / delete — Stripe sets `status: 'canceled'` on the deleted event, so the upsert naturally captures it.

### 4.2 Webhook route handler

`app/api/webhooks/stripe/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { handleSubscriptionEvent } from '@/lib/stripe/handle-subscription-event'
import type Stripe from 'stripe'

export const runtime = 'nodejs'
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
    // Return 500 so Stripe retries (up to 3 days). Most transient DB issues
    // self-heal. Persistent failures show up in Vercel logs + Stripe retry queue.
    return NextResponse.json({ error: `Handler failed: ${message}` }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
```

### 4.3 Premium audit

Grep all `getUserPremiumStatus` callers:

```bash
grep -rn "getUserPremiumStatus\|requirePremium" lib/ app/ 2>&1
```

For each call site, verify:
- Call is `await`ed.
- Returns proper error on non-premium (`{ success: false, error: 'PREMIUM_REQUIRED:...' }` per project pattern).
- The check is in the right place (before any premium-only DB write).

Expected call sites (from prior audits + Phase 1 + DP3):
- `lib/actions/snapshot.actions.ts` — `getChapterSnapshotsAction`, `restoreSnapshotAction`, `getSnapshotContentAction`.
- `lib/actions/publishing.actions.ts` — `getPublishingMetadataAction`, `updatePublishingMetadataAction`.
- `lib/actions/book.actions.ts` — `createBookAction` (likely uses `getUserPremiumStatus` to enforce `FREE_BOOK_LIMIT`).
- `lib/actions/hive.actions.ts` — `createHiveAction` (enforces `FREE_HIVE_LIMIT`).

Most likely zero edits required (P8A's refactor preserved the function signature). Audit produces a confidence pass + a documented list.

### 4.4 Unit tests

`__tests__/handle-subscription-event.test.ts`:

Two tests at minimum:
1. **Happy path:** existing userBilling row, event arrives, row gets updated with new status + currentPeriodEnd.
2. **Race recovery:** userBilling row missing, Stripe customer has metadata.userId, row gets inserted.

Optional third:
3. **Race recovery — missing metadata:** userBilling row missing, customer has no metadata.userId → throws.

Mock `db.query.userBilling.findFirst` + `db.insert(...).onConflictDoUpdate` + `stripe.customers.retrieve`.

If mocking Drizzle proves invasive, simplify to one integration test that uses an actual test DB. The handler is small enough that we don't need exhaustive coverage; the goal is to verify the race-recovery branch exists and works.

## 5. Files

**New:**
- `lib/stripe/handle-subscription-event.ts`
- `__tests__/handle-subscription-event.test.ts`

**Modified:**
- `app/api/webhooks/stripe/route.ts` — switch dispatches to handler, returns 500 on throw
- `AGENTS.md`
- Possibly: any premium-gated action file with a drift bug from the audit (unlikely)

**No DB schema changes. No new server actions. No new types.**

## 6. Risks

1. **Stripe event payload shape changes.** Pinned `apiVersion` in `lib/stripe/client.ts` (P8A) prevents this for the pinned version. When upgrading `apiVersion`, re-verify handler types. Inline comment in handler.

2. **Missing `customer.metadata.userId` on race recovery.** Handler throws → 500 → Stripe retries → eventually gives up. Logs the customer ID for triage. Extremely rare (requires `ensureStripeCustomer` to crash mid-flight without setting metadata — practically impossible given the SDK call signature).

3. **Subtle side effect drift.** Upserts are idempotent for the fields they set. If P8C or future tasks add side effects (welcome emails, etc.), retries would re-fire them. Documented constraint in the handler. Future work that adds side effects must add idempotency (e.g., dedupe by `event.id`).

4. **Time-zone / timestamp drift.** Stripe: Unix seconds. Postgres: `timestamp`. Conversion via `new Date(ts * 1000)`. Test in Task 4 via Stripe CLI trigger (the value comes back through and gets stored).

5. **Cascading 500s.** If handler throws 500 for 3 days, Stripe stops retrying. Those events are then lost. Mitigation: monitor Vercel logs for webhook 500s after the dashboard URL is configured. For MVP we accept this; events older than 3 days are extreme edge cases.

6. **TypeScript narrowing of `subscription.status`.** Stripe SDK types `Subscription.status` as a union including statuses not in our enum (e.g., `paused`). The upsert may fail at the DB layer if a value arrives that's outside our enum. Mitigation: validate against the enum before insert; if a status arrives that we don't recognize, log + skip (don't throw). Alternative: extend the enum. Confirm during impl whether Stripe sends statuses we haven't enumerated.

## 7. Testing

**Unit (`npm test`):**
- 121 existing tests + 2 new tests for the handler = 123 total expected.
- New tests cover happy-path upsert + race-recovery upsert.

**Manual (Stripe CLI):**
1. `stripe listen --forward-to localhost:3000/api/webhooks/stripe` → copy `whsec_...` to `STRIPE_WEBHOOK_SECRET`.
2. Restart dev.
3. `stripe trigger customer.subscription.created` → DB has new row: `subscriptionStatus = 'active' | 'trialing'`, ID + period populated.
4. `stripe trigger customer.subscription.updated` → DB row updated.
5. `stripe trigger customer.subscription.deleted` → DB row: `subscriptionStatus = 'canceled'`.
6. Manually delete the `userBilling` row in Neon, then trigger an event → race-recovery upserts a new row.
7. End-to-end: `/pricing` → Stripe Checkout (test card `4242 4242 4242 4242`) → checkout completes → `stripe listen` forwards the subscription.created event → DB updates → reload studio → premium features unlocked.

## 8. Definition of Done

- 4 atomic commits + AGENTS.md close-out.
- All 7 manual tests pass.
- `tsc` clean.
- `npm test` clean (123 expected).
- `getUserPremiumStatus` audit complete; any drift fixed.
- AGENTS.md Resume Here + P8C entry + pattern entry + post-deploy webhook instructions.
- Pushed to origin/main.

**Post-deploy (NOT part of P8C code — Chris does in Stripe dashboard):**
- Configure webhook endpoint: `https://{prod-domain}/api/webhooks/stripe`.
- Subscribe to: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Copy the signing secret → Vercel env `STRIPE_WEBHOOK_SECRET`.
- Test the live webhook from the dashboard.

## 9. Next sub-project (informational)

- **P8D:** Settings → Billing page wired to `createBillingPortalSessionAction`. Downgrade UX (soft-lock when premium loss pushes user over `FREE_BOOK_LIMIT` / `FREE_HIVE_LIMIT`). Cancellation flow. Optional: invoice history display.
