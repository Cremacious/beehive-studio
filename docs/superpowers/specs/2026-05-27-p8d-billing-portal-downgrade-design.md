# P8D — Billing Portal + Downgrade UX Design Spec

> **Date:** 2026-05-27
> **Sub-project:** Phase 8D — fourth and FINAL Phase 8 sub-project. Closes Phase 8.
> **Status:** Design approved; pending implementation plan.

---

## 1. Goal

Land the final Phase 8 piece: a billing page at `/[locale]/(app)/settings/billing` showing the user's subscription state with a Stripe Portal launch button, plus soft-lock UX for content that overflows free-tier limits after a downgrade. After P8D, the full subscription lifecycle is covered end-to-end: buy → sync → manage → cancel → downgrade gracefully.

## 2. Context

Phase 8 decomposition:
- ✅ P8A Foundations — Stripe SDK, schema, `createBillingPortalSessionAction`, webhook scaffold.
- ✅ P8B Pricing + Checkout — `/pricing` page, sign-up `?next=`, `/welcome`.
- ✅ P8C Webhooks + Entitlement — real handler, race-recovery, premium audit clean.
- **P8D Billing portal + downgrade UX** (this spec — closes Phase 8).

Locked decisions from the brainstorm:
1. Single billing page only — no Settings shell.
2. Route: `/[locale]/(app)/settings/billing`.
3. Page depth: hero status + plan + billing date + cancel-at-period-end indicator + manage button.
4. Book overflow: soft-lock (read-only, "Upgrade to edit" banner) — oldest 3 stay active.
5. Hive overflow: existing members keep editing; block new invites only.
6. `past_due` treated as still premium (add to `PREMIUM_STATUSES` in `lib/premium.ts`).
7. Hero-style status display.

## 3. Non-goals

- Settings shell with multiple tabs (Profile, Notifications, etc.). Single Billing page only per Q1 lock.
- Plan switching inline (Monthly ↔ Annual). Stripe Portal handles this natively; no need to duplicate.
- Invoice history display. Stripe Portal handles this natively.
- Auto-archive of overflow books. Soft-lock per Q4 lock.
- Auto-kick of hive members. Block invites only per Q5 lock.
- A "downgrade preview" UI (showing what will happen when subscription ends). Out of MVP scope; users see the actual state after cancellation.
- Dunning emails (failed payment notifications via email). Stripe handles those natively via its own email settings.

## 4. Architecture

### 4.1 Task 1 — Premium status semantics

`lib/premium.ts`:

```ts
const PREMIUM_STATUSES = new Set(['active', 'trialing', 'past_due'])
```

The third value (`past_due`) was missing; adding it makes the function honor Stripe's grace period (typically ~3 weeks while Stripe retries the failed renewal). Per Q6 lock: users in past_due keep premium access; billing page shows a warning.

Update `__tests__/premium.test.ts` to add a past_due test case (asserts `getUserPremiumStatus` returns true).

Test count: 125 → 126.

### 4.2 Task 2 — Billing page

Route: `/[locale]/(app)/settings/billing`.

`page.tsx` (server component):

```tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ManageButton } from './_components/manage-button'

export const dynamic = 'force-dynamic'

export default async function BillingPage({
  params,
}: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect(`/${locale}/sign-in?next=/${locale}/settings/billing`)

  const billing = await db.query.userBilling.findFirst({
    where: eq(userBilling.userId, session.user.id),
    columns: {
      subscriptionStatus: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
    },
  })

  const status = billing?.subscriptionStatus ?? null

  // Render branches: free / active+trialing / past_due / canceled
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Billing
        </h1>
      </header>

      {/* No subscription — free tier */}
      {!status && (
        <Card>
          <h2 className="text-xl font-semibold">You're on the free tier</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Up to 3 books, 3 Hives, and the community.
          </p>
          <Link
            href={`/${locale}/pricing`}
            className="inline-block mt-4 rounded-md bg-brand text-brand-ink font-semibold px-4 py-2 hover:bg-brand-hover transition-colors"
          >
            See Premium
          </Link>
        </Card>
      )}

      {/* active / trialing — hero status */}
      {(status === 'active' || status === 'trialing') && (
        <Card>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            You're on Premium
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {status === 'trialing' ? 'Free trial' : 'Active subscription'}
            {billing?.currentPeriodEnd && (
              <> · renews {formatDate(billing.currentPeriodEnd)}</>
            )}
          </p>
          <ManageButton locale={locale} className="mt-6" />
        </Card>
      )}

      {/* past_due — warning + manage */}
      {status === 'past_due' && (
        <Card variant="warning">
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Payment failed
          </h2>
          <p className="text-sm mt-1">
            Your last payment didn't go through. Stripe is retrying — update your card
            in the next few weeks to avoid losing premium access.
          </p>
          <ManageButton locale={locale} className="mt-6" />
        </Card>
      )}

      {/* canceled — show end date + re-subscribe CTA */}
      {status === 'canceled' && (
        <Card>
          <h2 className="text-xl font-semibold">Your subscription ended</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {billing?.currentPeriodEnd ? `Ended on ${formatDate(billing.currentPeriodEnd)}.` : ''}
            You're on the free tier now.
          </p>
          <Link
            href={`/${locale}/pricing`}
            className="inline-block mt-4 rounded-md bg-brand text-brand-ink font-semibold px-4 py-2 hover:bg-brand-hover transition-colors"
          >
            Resubscribe
          </Link>
        </Card>
      )}

      {/* Other statuses (incomplete, unpaid, paused) — generic + manage */}
      {status && !['active', 'trialing', 'past_due', 'canceled'].includes(status) && (
        <Card>
          <h2 className="text-xl font-semibold">Subscription status: {status}</h2>
          <ManageButton locale={locale} className="mt-6" />
        </Card>
      )}
    </main>
  )
}
```

(`Card` and `formatDate` are local helpers; can be inline or in a colocated util.)

`_components/manage-button.tsx` (client component):

```tsx
'use client'

import { useState } from 'react'
import { createBillingPortalSessionAction } from '@/lib/actions/billing.actions'
import { cn } from '@/lib/utils'

type Props = { locale: string; className?: string }

export function ManageButton({ locale, className }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (loading) return
    setError(null)
    setLoading(true)
    const result = await createBillingPortalSessionAction({ locale })
    if (result.success) {
      window.location.href = result.data.url
    } else {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          'rounded-md bg-brand text-brand-ink font-semibold px-4 py-2 hover:bg-brand-hover transition-colors disabled:opacity-50',
          className,
        )}
      >
        {loading ? 'Opening…' : 'Manage subscription'}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
```

`createBillingPortalSessionAction` is from P8A; its return_url already points at `/[locale]/settings/billing` so users land back on this page after closing the Portal.

### 4.3 Task 3 — Book overflow soft-lock

`lib/billing/book-overflow.ts`:

```ts
import { db } from '@/db'
import { books } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getUserPremiumStatus, FREE_BOOK_LIMIT } from '@/lib/premium'

/**
 * Returns true when a non-premium user has more than FREE_BOOK_LIMIT books
 * AND the given book is one of the overflow books.
 *
 * Overflow is determined by createdAt ASC — the user's oldest FREE_BOOK_LIMIT
 * books remain active; subsequent books overflow. Stable choice: doesn't shift
 * as users edit (vs. updatedAt which would cause the overflow set to rotate).
 */
export async function isBookOverflow(userId: string, bookId: string): Promise<boolean> {
  const isPremium = await getUserPremiumStatus(userId)
  if (isPremium) return false

  const userBooks = await db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.userId, userId))
    .orderBy(asc(books.createdAt))

  const index = userBooks.findIndex(b => b.id === bookId)
  if (index === -1) return false // book not found (caller will error elsewhere)

  return index >= FREE_BOOK_LIMIT
}
```

Apply at the gate points:
- `lib/actions/chapter.actions.ts` — `saveChapterAction`: before write, check `isBookOverflow(userId, bookId)`. Return `{ success: false, error: 'FREE_LIMIT_REACHED' }` if true.
- `lib/actions/binder.actions.ts` — `createBinderItemAction`, `updateBinderItemAction`, `deleteBinderItemAction`, `reorderBinderItemsAction` (and any other write actions for items belonging to a book): same gate.

UI banner:

`app/[locale]/(app)/studio/[bookId]/_components/overflow-banner.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

export function OverflowBanner() {
  const params = useParams<{ locale: string }>()
  return (
    <div className="bg-brand/15 border-b border-brand/40 px-4 py-2 flex items-center justify-between gap-3">
      <p className="text-sm text-foreground">
        This book is read-only because you&apos;re on the free tier. Upgrade to keep editing.
      </p>
      <Link
        href={`/${params.locale}/pricing`}
        className="text-xs font-semibold rounded-md bg-brand text-brand-ink px-3 py-1.5 hover:bg-brand-hover transition-colors"
      >
        Upgrade
      </Link>
    </div>
  )
}
```

Mounted in `chapter-editor.tsx` (or higher in the studio shell) when the current book is overflow. The page can fetch `isBookOverflow(userId, bookId)` server-side and pass a prop down, OR the studio shell can do the check once and gate the banner conditionally.

Simplest: pass `bookOverflow` prop from `studio/[bookId]/page.tsx` (server component) into the editor; banner renders when `bookOverflow === true`.

**Note for /studio book grid (list page):** a visual marker on overflow books would be nice but is not strictly required by the soft-lock guarantee. The gate at the action layer prevents data loss; the banner inside the book prevents confusion. Skipping the grid marker is acceptable for MVP; document as a follow-up.

### 4.4 Task 4 — Hive invite gate

`lib/actions/hive.actions.ts`:

- Find the `inviteAction` (or similar) and `joinHiveByLinkAction`.
- Both currently check premium status of the OWNER (per P8C audit). The check pattern is:

```ts
const owner = await ... // find hive owner
const ownerIsPremium = await getUserPremiumStatus(owner.userId)
const memberCount = await ... // count current members
const limit = ownerIsPremium ? Infinity : FREE_HIVE_MEMBER_LIMIT
if (memberCount >= limit) {
  return { success: false, error: 'FREE_LIMIT_REACHED' }
}
```

This pattern ALREADY exists for the invite path. P8D just needs to confirm:
- `joinHiveByLinkAction` uses the same gate.
- Both actions return `FREE_LIMIT_REACHED` cleanly so the UI shows an upsell.

If both checks are already in place, this task is a confirmation pass (no code change). If one is missing, add it.

**No change to hive UI** — existing 8-member hive renders unchanged. Only the invite + join actions block.

## 5. Files

**New:**
- `app/[locale]/(app)/settings/billing/page.tsx`
- `app/[locale]/(app)/settings/billing/_components/manage-button.tsx`
- `lib/billing/book-overflow.ts`
- `app/[locale]/(app)/studio/[bookId]/_components/overflow-banner.tsx`

**Modified:**
- `lib/premium.ts` (add `past_due` to `PREMIUM_STATUSES`)
- `__tests__/premium.test.ts` (add past_due test case)
- `lib/actions/chapter.actions.ts` (saveChapterAction overflow gate)
- `lib/actions/binder.actions.ts` (binder-item action overflow gates)
- `app/[locale]/(app)/studio/[bookId]/page.tsx` (compute + pass bookOverflow prop)
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` (mount OverflowBanner)
- Possibly: `lib/actions/hive.actions.ts` (if invite/join gate is missing)
- `AGENTS.md`

**No DB schema changes. No new server actions. No new types.**

## 6. Risks

1. **Soft-lock determinism (createdAt ASC).** If a user prefers their newest 3 books as active, they'd be confused. Document the rule clearly in the overflow banner and in the helper's comment. Future enhancement: a "Pick 3 to keep active" UI when downgrading. Out of MVP scope.

2. **Race: webhook lands after Portal return.** User cancels → returns to `/settings/billing` → webhook hasn't fired yet → page shows "still active." Mitigates after a few seconds when the next render catches the new status. Add a note to the page header during certain states ("Status updates within a few seconds of changes").

3. **`past_due` semantics change.** P8C's premium audit confirmed all callers; adding `past_due` to the set is uniformly the right behavior for the use case (extends grace). Re-verify mentally during the test sweep.

4. **Book-overflow check cost.** One book-list query per gated server action. Acceptable at MVP scale (free users have ≤ a handful of books). Could be optimized via a materialized `overflowsLimit` column on `books` later.

5. **Hive invite-block UX.** Action returns `FREE_LIMIT_REACHED` — the calling UI needs to handle this and show an upsell toast/banner. The existing toast pattern from DP4 handles error display; the message can be brand-y ("Premium lets you grow your Hive past 5 members. [Upgrade →]"). Confirm during impl that the hive invite UI actually renders the error.

6. **Empty `userBilling` row.** A free-tier user who's never paid has no row in `userBilling`. The page already handles this (renders the "free tier" branch). Confirm: the `findFirst` returns undefined → `status` is null → free-tier branch renders. No throw.

7. **Other Stripe statuses (`incomplete`, `unpaid`, `paused`).** Page has a generic fallback branch for these; shows status + Manage button. Rare in practice but covered.

## 7. Testing (manual)

1. Free-tier user (no `userBilling` row) → `/settings/billing` shows "You're on the free tier" + "See Premium" CTA.
2. Premium (`active`) user → hero "You're on Premium · Active subscription · renews {date}" + Manage button.
3. `trialing` user → hero with "Free trial" subtitle.
4. Click Manage → Stripe Portal opens; close it; lands back on `/settings/billing`.
5. Set status to `past_due` manually → page shows warning card with "Payment failed" + Manage button. Premium features still work (snapshot drawer, publishing).
6. Cancel from Stripe Portal → after webhook fires, `/settings/billing` shows "Your subscription ended" + Resubscribe CTA.
7. Premium user with 5 books cancels → 2 oldest books editable; books 3-5 show overflow banner + writes return `FREE_LIMIT_REACHED`.
8. Premium user with 8-member hive cancels → existing 8 members can still post/comment; owner tries to invite → action returns `FREE_LIMIT_REACHED`; UI shows upsell.
9. `npx tsc --noEmit` clean. `npm test` clean (126 expected: 125 + 1 past_due test).

## 8. Definition of Done

- 4 atomic commits + AGENTS.md close-out commit (5 total).
- All 9 manual tests pass.
- `tsc` clean. `npm test` clean (126 expected).
- Billing page renders for all 4 main states (none / active+trialing / past_due / canceled).
- Manage button works end-to-end (opens Portal, returns cleanly).
- Book overflow gate enforced at action layer; banner visible on overflow books.
- Hive invite/join blocked when over `FREE_HIVE_MEMBER_LIMIT`.
- `past_due` honored as premium in `getUserPremiumStatus`.
- AGENTS.md Resume Here + P8D entry + Phase 8 close-out summary.
- Pushed to origin/main.

## 9. After P8D

Phase 8 (Stripe monetization) complete. Users can:
- Subscribe end-to-end via `/pricing` → Stripe Checkout → `/welcome`.
- See subscription state at `/settings/billing` + manage via Stripe Portal.
- Downgrade gracefully: data preserved, soft-locked, clear path back to premium.

What's NOT in P8: promo codes (Stripe Portal partially handles via `allow_promotion_codes`), free trial periods, multiple tiers, tax UX, dunning emails (Stripe-native), refund flows (Stripe Portal).

Future Phase 9 candidates: post-launch growth work — referral codes, annual-renewal nudges, plan upgrade prompts mid-flow, analytics on conversion funnel.
