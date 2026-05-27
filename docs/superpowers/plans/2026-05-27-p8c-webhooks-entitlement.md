# P8C Webhooks + Entitlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire real handler logic into `/api/webhooks/stripe` so subscription state syncs from Stripe to `userBilling`. Paying users actually become premium. Audit `getUserPremiumStatus` callers for correctness.

**Architecture:** Four atomic tasks. Handler module + route dispatch first. Then race-recovery logic + unit tests. Then premium audit (mostly confirmation, likely zero edits). Then manual Stripe CLI verification + AGENTS.md close-out.

**Tech Stack:** Stripe SDK (from P8A's pinned client), Drizzle ORM upserts, Next.js 16 route handler (`runtime: nodejs`).

**Spec:** [`docs/superpowers/specs/2026-05-27-p8c-webhooks-entitlement-design.md`](../specs/2026-05-27-p8c-webhooks-entitlement-design.md)

---

## File Structure

**New:**
- `lib/stripe/handle-subscription-event.ts`
- `__tests__/handle-subscription-event.test.ts`

**Modified:**
- `app/api/webhooks/stripe/route.ts`
- `AGENTS.md`
- Possibly: any drift discovered in premium-gated action files (likely zero)

**No DB changes. No new server actions. No new types.**

---

## Task 1: Handler module + webhook dispatch

**Files:**
- Create: `lib/stripe/handle-subscription-event.ts`
- Modify: `app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Read existing webhook route**

Read `app/api/webhooks/stripe/route.ts` (the P8A scaffold). Note:
- The signature verification pattern.
- The current switch statement that logs each event type.
- The `runtime` and `dynamic` exports.
- Return shapes (200 / 400 / 500).

- [ ] **Step 2: Confirm subscriptionStatus enum**

Read `db/schema/auth.ts` (or wherever userBilling lives — confirmed by P8A Task 1). Confirm `subscriptionStatusEnum` values include all 7 statuses Stripe might send:
- `active`, `trialing`, `past_due`, `canceled`, `incomplete`, `incomplete_expired`, `unpaid`

If Stripe also sends `paused` (newer addition), the upsert will fail at insert time. Either:
- Extend the enum to include `paused`, OR
- Validate before insert; skip with log if unknown.

Recommend extending the enum if needed (lossy alternative would be confusing). Apply via `npm run db:push`.

Note any enum changes for the commit message.

- [ ] **Step 3: Create the handler module**

Create `lib/stripe/handle-subscription-event.ts` per spec §4.1:

```ts
import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { stripe } from './client'
import type Stripe from 'stripe'

const KNOWN_STATUSES = new Set([
  'active', 'trialing', 'past_due', 'canceled',
  'incomplete', 'incomplete_expired', 'unpaid',
] as const)

type KnownStatus = typeof KNOWN_STATUSES extends Set<infer T> ? T : never

function isKnownStatus(s: string): s is KnownStatus {
  return (KNOWN_STATUSES as Set<string>).has(s)
}

/**
 * Handles customer.subscription.{created,updated,deleted} events.
 *
 * Idempotent by construction — every call upserts userBilling to the
 * subscription's current state, so repeated Stripe retries are safe.
 *
 * DO NOT add side effects (welcome emails, bonus grants) without first
 * adding event-id deduplication. Stripe retries the same event multiple
 * times on transient errors; side effects would re-fire.
 *
 * On userBilling row missing (race condition where webhook arrives before
 * ensureStripeCustomer committed), fetches the Stripe customer to recover
 * the userId from metadata.userId, then upserts.
 *
 * Throws on hard failures (missing metadata.userId, unknown status, DB
 * outage). The webhook route returns 500 on throw so Stripe retries.
 */
export async function handleSubscriptionEvent(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id

  if (!isKnownStatus(subscription.status)) {
    throw new Error(
      `Unknown subscription status "${subscription.status}" for customer ${customerId}`,
    )
  }

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
      throw new Error(
        `Cannot recover userBilling for deleted Stripe customer ${customerId}`,
      )
    }
    const metaUserId = customer.metadata?.userId
    if (!metaUserId) {
      throw new Error(
        `Stripe customer ${customerId} missing metadata.userId — cannot recover`,
      )
    }
    userId = metaUserId
  }

  const periodEnd = new Date(subscription.current_period_end * 1000)

  await db
    .insert(userBilling)
    .values({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: periodEnd,
    })
    .onConflictDoUpdate({
      target: userBilling.userId,
      set: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        currentPeriodEnd: periodEnd,
      },
    })
}
```

Type narrowing: the `isKnownStatus` check ensures the upsert receives a value matching the enum. If Stripe sends an unknown status (e.g., `paused`), we throw rather than corrupt the DB. The webhook returns 500 → Stripe retries → operator sees the error in logs and either extends the enum or investigates.

- [ ] **Step 4: Update the webhook route**

Modify `app/api/webhooks/stripe/route.ts` per spec §4.2. The signature verification stays; the switch is updated to dispatch to the handler:

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
```

- [ ] **Step 5: Type check + tests**

```bash
npx tsc --noEmit
npm test
```

Both clean. Tests still 121 (Task 2 adds new tests).

- [ ] **Step 6: Commit**

```bash
git add lib/stripe/handle-subscription-event.ts app/api/webhooks/stripe/route.ts db/schema/ 2>/dev/null
git add lib/stripe/handle-subscription-event.ts app/api/webhooks/stripe/route.ts
git commit -m "feat(stripe): wire subscription event handler (P8C Task 1)

New lib/stripe/handle-subscription-event.ts processes
customer.subscription.{created,updated,deleted} events:
upserts userBilling with subscriptionStatus + stripeSubscriptionId
+ currentPeriodEnd (Unix seconds → JS Date).

Idempotent by construction (same event re-applied = same final
state). Throws on unknown subscription status or hard DB errors;
webhook route returns 500 → Stripe retries.

Webhook route now dispatches to the handler instead of logging.
Other event types still logged + ignored.

DO NOT configure the Stripe dashboard webhook URL until after this
deploys — see post-deploy notes in AGENTS.md.

[If enum was extended: note 'subscription_status enum extended via
npm run db:push for newly-discovered Stripe statuses.']"
```

---

## Task 2: Race-recovery handling + unit tests

**Files:**
- Modify: `lib/stripe/handle-subscription-event.ts` (recovery logic already in Task 1; this task adds tests)
- Create: `__tests__/handle-subscription-event.test.ts`

The race-recovery code already shipped in Task 1's handler. This task adds unit tests that cover it.

- [ ] **Step 1: Read existing test setup**

Look at `__tests__/premium.test.ts` (rewritten in P8A Task 3). Note:
- Test runner (vitest).
- Mocking pattern (e.g., `vi.mock('@/db', ...)`).
- How the existing premium test stubs the db query helpers.

If the existing tests use a different mocking style than `vi.mock`, adapt the new tests to that style.

- [ ] **Step 2: Write the unit tests**

```ts
// __tests__/handle-subscription-event.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the db module
const findFirstMock = vi.fn()
const onConflictDoUpdateMock = vi.fn().mockResolvedValue(undefined)
const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock })
const insertMock = vi.fn().mockReturnValue({ values: valuesMock })

vi.mock('@/db', () => ({
  db: {
    query: {
      userBilling: {
        findFirst: findFirstMock,
      },
    },
    insert: insertMock,
  },
}))

vi.mock('@/db/schema', () => ({
  userBilling: { stripeCustomerId: 'stripe_customer_id_col', userId: 'user_id_col' },
}))

// Mock the Stripe client
const customersRetrieveMock = vi.fn()

vi.mock('@/lib/stripe/client', () => ({
  stripe: {
    customers: {
      retrieve: customersRetrieveMock,
    },
  },
}))

// Mock drizzle-orm eq (just returns its args; we don't assert structure)
vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}))

import { handleSubscriptionEvent } from '@/lib/stripe/handle-subscription-event'

const baseSubscription = {
  id: 'sub_test_123',
  customer: 'cus_test_abc',
  status: 'active' as const,
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
}

beforeEach(() => {
  findFirstMock.mockReset()
  onConflictDoUpdateMock.mockReset().mockResolvedValue(undefined)
  valuesMock.mockClear().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock })
  insertMock.mockClear().mockReturnValue({ values: valuesMock })
  customersRetrieveMock.mockReset()
})

describe('handleSubscriptionEvent', () => {
  it('upserts userBilling using existing row userId when found', async () => {
    findFirstMock.mockResolvedValue({ userId: 'user_existing_1' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleSubscriptionEvent(baseSubscription as any)

    expect(customersRetrieveMock).not.toHaveBeenCalled()
    expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_existing_1',
      stripeCustomerId: 'cus_test_abc',
      stripeSubscriptionId: 'sub_test_123',
      subscriptionStatus: 'active',
    }))
  })

  it('recovers via Stripe customer metadata when row is missing', async () => {
    findFirstMock.mockResolvedValue(undefined)
    customersRetrieveMock.mockResolvedValue({
      deleted: false,
      metadata: { userId: 'user_recovered_2' },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handleSubscriptionEvent(baseSubscription as any)

    expect(customersRetrieveMock).toHaveBeenCalledWith('cus_test_abc')
    expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_recovered_2',
    }))
  })

  it('throws when recovery customer is missing metadata.userId', async () => {
    findFirstMock.mockResolvedValue(undefined)
    customersRetrieveMock.mockResolvedValue({
      deleted: false,
      metadata: {},
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(handleSubscriptionEvent(baseSubscription as any)).rejects.toThrow(
      /missing metadata.userId/,
    )
    expect(valuesMock).not.toHaveBeenCalled()
  })

  it('throws on unknown subscription status', async () => {
    findFirstMock.mockResolvedValue({ userId: 'user_x' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub: any = { ...baseSubscription, status: 'paused' }
    await expect(handleSubscriptionEvent(sub)).rejects.toThrow(/Unknown subscription status/)
    expect(valuesMock).not.toHaveBeenCalled()
  })
})
```

If the mocking style above (chained mock returns for `db.insert().values().onConflictDoUpdate()`) is fragile or doesn't match the project's pattern, simplify by mocking at a coarser level OR convert one or two of these tests to integration tests using a real test DB.

Goal is 3-4 small tests, not exhaustive coverage. The race-recovery branch is the load-bearing thing to verify.

- [ ] **Step 3: Run tests**

```bash
npx tsc --noEmit
npm test
```

Both clean. Expected count: 121 + 4 new = 125. Adjust report if you wrote fewer/more.

- [ ] **Step 4: Commit**

```bash
git add __tests__/handle-subscription-event.test.ts
git commit -m "test(stripe): handle-subscription-event unit tests (P8C Task 2)

4 tests covering:
- Happy path: existing userBilling row, upsert with that userId.
- Race recovery: row missing, Stripe customer metadata provides userId,
  upsert creates the row.
- Recovery failure: customer has no metadata.userId → throws.
- Unknown status: subscription.status not in enum → throws (prevents
  DB corruption if Stripe adds a new status we haven't enumerated).

Mocks @/db, @/lib/stripe/client, and drizzle-orm at the module level.
Goal is verifying the race-recovery branch exists and works — not
exhaustive coverage."
```

---

## Task 3: Premium audit

**Files:**
- Possibly modify: any drift discovered in premium-gated action files (likely zero)

- [ ] **Step 1: Grep all `getUserPremiumStatus` and `requirePremium` callers**

```bash
grep -rn "getUserPremiumStatus\|requirePremium" lib/ app/ 2>&1 | grep -v "lib/premium.ts" | head -30
```

Expected matches (from spec §4.3):
- `lib/actions/snapshot.actions.ts`
- `lib/actions/publishing.actions.ts`
- `lib/actions/book.actions.ts`
- `lib/actions/hive.actions.ts`
- Possibly others (chapter actions, etc.)

- [ ] **Step 2: Read each call site**

For each match, open the file and verify:
- The call is `await`ed (it returns a Promise).
- The error return on non-premium uses the project pattern: `{ success: false, error: 'PREMIUM_REQUIRED:<feature>' }`.
- The check happens BEFORE any premium-only DB write or computation.
- The function uses `userId` from `requireAuth()` correctly.

- [ ] **Step 3: Document findings**

Create a short note (in the commit message or a comment) listing each call site reviewed + any fixes applied. Most likely zero fixes — P8A's refactor preserved signatures.

If you find drift (e.g., a call that's not awaited, or returns wrong error code), fix it.

- [ ] **Step 4: Type check + tests**

```bash
npx tsc --noEmit
npm test
```

Both clean. If you made fixes, tests should still pass.

- [ ] **Step 5: Commit**

If you made code changes:

```bash
git add lib/actions/
git commit -m "chore(premium): audit getUserPremiumStatus callers (P8C Task 3)

Reviewed N call sites. [Fixed: <describe>] OR [No drift; all sites
use the correct pattern.]

Sites verified:
- lib/actions/snapshot.actions.ts (getChapterSnapshotsAction,
  restoreSnapshotAction, getSnapshotContentAction)
- lib/actions/publishing.actions.ts (getPublishingMetadataAction,
  updatePublishingMetadataAction)
- lib/actions/book.actions.ts (createBookAction — enforces FREE_BOOK_LIMIT)
- lib/actions/hive.actions.ts (createHiveAction — enforces FREE_HIVE_LIMIT)
- [any others discovered]"
```

If no changes: skip the commit; document findings in Task 4's commit message.

---

## Task 4: Stripe CLI manual test + AGENTS.md + push

**Files:**
- Modify: `AGENTS.md`

This task is mostly manual verification + close-out. Chris runs the Stripe CLI tests himself (subagent shouldn't try to invoke Stripe CLI).

- [ ] **Step 1: Confirm automated checks**

```bash
npx tsc --noEmit
npm test
```

Tests should be at 125 expected (121 + 4 new from Task 2).

- [ ] **Step 2: Update AGENTS.md**

Read `AGENTS.md`. Update Resume Here:
- Last updated: 2026-05-27
- Current focus: "P8C Webhooks + entitlement complete; P8D Billing portal + downgrade UX next. POST-DEPLOY: configure Stripe dashboard webhook (see Key Patterns)."
- Last commit: `git log -1 --format=%s` after this commit.
- Next concrete step: "invoke /brainstorming for P8D Billing portal + downgrade UX. ALSO: configure the Stripe dashboard webhook URL — see Post-deploy section below."

Add a P8C pattern entry:

> **P8C webhook pattern:** `lib/stripe/handle-subscription-event.ts` is the single entry point for `customer.subscription.{created,updated,deleted}` events. Idempotent by construction (upserts `userBilling`). Race-recovery: if the userBilling row is missing for a `stripeCustomerId`, fetch the Stripe customer's `metadata.userId` and upsert. Throws on unknown subscription status (prevents DB corruption) or hard failures; webhook route returns 500 → Stripe retries. **DO NOT add side effects** to the handler (welcome emails, etc.) without first adding event-ID deduplication — Stripe retries fire side effects multiple times.

Add a P8C entry under "What Has Been Built":

```markdown
### P8C — Webhooks + Entitlement ✅ COMPLETE (2026-05-27)
Third of four Phase 8 sub-projects.

- **Subscription event handler** (`lib/stripe/handle-subscription-event.ts`): processes `customer.subscription.{created,updated,deleted}` events. Upserts `userBilling.subscriptionStatus`, `stripeSubscriptionId`, `currentPeriodEnd`. Idempotent by construction.
- **Race-recovery branch:** if `userBilling` row is missing for a `stripeCustomerId`, the handler fetches the Stripe customer to read `metadata.userId` (set by P8A's `ensureStripeCustomer`) and upserts. Self-healing.
- **Hard failure modes:** unknown subscription status (Stripe added a value we haven't enumerated) or missing customer metadata → throws → webhook returns 500 → Stripe retries up to 3 days. Logs the customer ID for triage.
- **Webhook route** (`app/api/webhooks/stripe/route.ts`): now dispatches to the handler instead of logging. Other events still logged + ignored.
- **Premium audit:** verified all `getUserPremiumStatus` / `requirePremium` callers use the function correctly after P8A's refactor. [Drift found: yes/no — describe if yes.]
- **Unit tests:** 4 new tests for the handler (happy path, race recovery, missing metadata, unknown status). Total: 125 (121 prior + 4 new).

No DB schema changes. No new server actions.

**Post-deploy (NOT in code — Chris does in Stripe dashboard):**
1. Configure webhook endpoint at `https://{prod-domain}/api/webhooks/stripe`.
2. Subscribe to: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Copy signing secret → Vercel env `STRIPE_WEBHOOK_SECRET`.
4. Test from dashboard's "Send test webhook" UI.

**Next:** P8D — Settings → Billing portal + downgrade UX (soft-lock when premium loss pushes user >FREE_BOOK_LIMIT or >FREE_HIVE_LIMIT).
```

- [ ] **Step 3: Commit + push**

```bash
git add AGENTS.md
git commit -m "docs: close P8C Webhooks + Entitlement (Phase 8 third sub-project shipped)

Subscription events now sync userBilling state. After this deploys
and Chris configures the Stripe dashboard webhook URL, paying users
become premium automatically.

Premium audit confirmed all getUserPremiumStatus callers use the
function correctly after P8A's refactor.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"

git push origin main
```

- [ ] **Step 4: Manual Stripe CLI test (Chris runs)**

After push, Chris does this part:

```bash
# Terminal 1
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Note the whsec_... it prints; put it in .env.local if not already set; restart dev

# Terminal 2 (test events)
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

After each trigger, check Neon dashboard for the `userBilling` row. Subscription status should reflect the trigger.

End-to-end: with `stripe listen` running, complete a real checkout via `/pricing` with test card. Watch the events forward; verify the row updates; reload studio and see premium features unlocked.

If anything breaks, fix before configuring the production dashboard webhook.

---

## Definition of Done

- 3-4 atomic commits (Task 1, Task 2, optionally Task 3, AGENTS.md).
- `tsc` clean.
- `npm test` clean (125 expected — 121 + 4 new tests).
- `lib/stripe/handle-subscription-event.ts` implements upsert + race-recovery.
- Webhook route dispatches to handler; returns 500 on errors.
- Premium audit completed (likely zero edits).
- AGENTS.md Resume Here + P8C entry + pattern entry + post-deploy instructions.
- Pushed to origin/main.

**Post-deploy (Chris's manual step):** Configure Stripe dashboard webhook URL. Subscribe to 3 subscription events. Copy signing secret to Vercel env.
