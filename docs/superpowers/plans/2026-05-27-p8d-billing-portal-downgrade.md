# P8D Billing Portal + Downgrade UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/settings/billing` page (hero status + Manage button → Stripe Portal), soft-lock overflow books with read-only banner, gate hive invites over the free-tier limit, extend premium semantics to include `past_due`. Closes Phase 8.

**Architecture:** Four atomic tasks. Premium-semantics tweak first (smallest, unblocks downstream behavior). Then billing page. Then book overflow soft-lock (the largest task — touches binder + chapter action gates + editor UI). Then hive invite gate + AGENTS.md close-out + push.

**Tech Stack:** Next.js 16 App Router (server components, ISR for dynamic billing page), Drizzle ORM (book-list query for overflow check), Stripe Portal (via P8A's action), shadcn/Tailwind v4 with paper-context tokens.

**Spec:** [`docs/superpowers/specs/2026-05-27-p8d-billing-portal-downgrade-design.md`](../specs/2026-05-27-p8d-billing-portal-downgrade-design.md)

---

## File Structure

**New:**
- `app/[locale]/(app)/settings/billing/page.tsx`
- `app/[locale]/(app)/settings/billing/_components/manage-button.tsx`
- `lib/billing/book-overflow.ts`
- `app/[locale]/(app)/studio/[bookId]/_components/overflow-banner.tsx`

**Modified:**
- `lib/premium.ts` (`PREMIUM_STATUSES` adds `past_due`)
- `__tests__/premium.test.ts` (add past_due test)
- `lib/actions/chapter.actions.ts` (saveChapterAction gate)
- `lib/actions/binder.actions.ts` (binder-item action gates)
- `app/[locale]/(app)/studio/[bookId]/page.tsx` (compute + pass `bookOverflow` prop)
- `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` (mount OverflowBanner)
- Possibly: `lib/actions/hive.actions.ts` (if invite/join gate is missing — P8C audit said both already gate, verify)
- `AGENTS.md`

**No DB schema changes. No new server actions. No new types.**

---

## Task 1: Premium semantics — `past_due` is premium

**Files:**
- Modify: `lib/premium.ts`
- Modify: `__tests__/premium.test.ts`

- [ ] **Step 1: Read current state**

```bash
cat lib/premium.ts | head -40
```

Confirm `PREMIUM_STATUSES` currently is `new Set(['active', 'trialing'])`. Find the test file's existing structure.

- [ ] **Step 2: Add `past_due` to the set**

```ts
// lib/premium.ts
const PREMIUM_STATUSES = new Set(['active', 'trialing', 'past_due'])
```

Update the JSDoc comment on `getUserPremiumStatus` to mention the new semantics:

```ts
/**
 * Returns true if the user has an active or trialing subscription, OR is in
 * Stripe's grace period (past_due). The grace period typically lasts ~3 weeks
 * while Stripe retries failed payments. Treating past_due as premium prevents
 * a card hiccup from immediately cutting off access; once Stripe gives up the
 * retry cycle, the webhook sets the status to 'canceled' and access reverts.
 *
 * Dev override: ...
 */
```

- [ ] **Step 3: Add past_due test case**

In `__tests__/premium.test.ts`, find the existing block of status-specific assertions added in P8A Task 3. Add an additional case:

```ts
it('returns true when subscription is past_due (grace period)', async () => {
  // Mock setup mirroring the existing 'active' test, but with status: 'past_due'
  // ...
  expect(await getUserPremiumStatus(USER_ID)).toBe(true)
})
```

Adapt the mocking to whatever style the existing tests use (likely `vi.hoisted` + `vi.mock` per P8A Task 3's pattern).

- [ ] **Step 4: Type check + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: 126 tests (125 + 1 new). Both clean.

- [ ] **Step 5: Commit**

```bash
git add lib/premium.ts __tests__/premium.test.ts
git commit -m "feat(premium): past_due is premium (extends grace period) (P8D Task 1)

getUserPremiumStatus now returns true for 'active', 'trialing', and
'past_due'. Stripe's past_due state is the grace period during which
it retries a failed renewal payment (~3 weeks). Treating it as
premium prevents a card hiccup from immediately cutting off access;
the webhook flips status to 'canceled' when Stripe finally gives up,
at which point the user becomes free-tier.

Test added: past_due → returns true."
```

---

## Task 2: Billing page

**Files:**
- Create: `app/[locale]/(app)/settings/billing/page.tsx`
- Create: `app/[locale]/(app)/settings/billing/_components/manage-button.tsx`

- [ ] **Step 1: Confirm settings doesn't exist yet**

```bash
ls "app/[locale]/(app)/settings" 2>&1 || echo "settings directory does not exist"
```

The directory likely doesn't exist; create it as part of the page file.

Read `app/[locale]/(app)/layout.tsx` to confirm session enforcement (so we don't need a manual check in the billing page).

- [ ] **Step 2: Create the manage button (client component)**

```tsx
// app/[locale]/(app)/settings/billing/_components/manage-button.tsx
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

- [ ] **Step 3: Create the billing page (server component)**

```tsx
// app/[locale]/(app)/settings/billing/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ManageButton } from './_components/manage-button'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ locale: string }> }

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function BillingPage({ params }: Props) {
  const { locale } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect(`/${locale}/sign-in?next=/${locale}/settings/billing`)
  }

  const billing = await db.query.userBilling.findFirst({
    where: eq(userBilling.userId, session.user.id),
    columns: {
      subscriptionStatus: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
    },
  })

  const status = billing?.subscriptionStatus ?? null

  return (
    <main className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
          Billing
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Subscription status updates may take a few seconds to reflect changes from Stripe.
        </p>
      </header>

      {/* Free tier — no userBilling row, or no subscription */}
      {!status && (
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground">You&apos;re on the free tier</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Up to 3 books, 3 Hives, and full community access. Upgrade for unlimited everything, version history, and publishing details.
          </p>
          <Link
            href={`/${locale}/pricing`}
            className="inline-block mt-4 rounded-md bg-brand text-brand-ink font-semibold px-4 py-2 hover:bg-brand-hover transition-colors"
          >
            See Premium
          </Link>
        </section>
      )}

      {/* Active / trialing — hero status */}
      {(status === 'active' || status === 'trialing') && (
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            You&apos;re on Premium
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {status === 'trialing' ? 'Free trial' : 'Active subscription'}
            {billing?.currentPeriodEnd && <> · renews {formatDate(new Date(billing.currentPeriodEnd))}</>}
          </p>
          <ManageButton locale={locale} className="mt-6" />
        </section>
      )}

      {/* past_due — warning */}
      {status === 'past_due' && (
        <section
          className="bg-card border-2 border-amber-500/40 rounded-lg p-6"
          style={{ borderColor: 'oklch(0.80 0.14 80 / 0.45)' }}
        >
          <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            Payment failed
          </h2>
          <p className="text-sm text-foreground mt-1 leading-relaxed">
            Your last payment didn&apos;t go through. Stripe is retrying — update your card in the next few weeks to keep premium access.
          </p>
          <ManageButton locale={locale} className="mt-6" />
        </section>
      )}

      {/* Canceled — show end date + re-subscribe */}
      {status === 'canceled' && (
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground">Your subscription ended</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {billing?.currentPeriodEnd && <>Ended on {formatDate(new Date(billing.currentPeriodEnd))}. </>}
            You&apos;re on the free tier now.
          </p>
          <Link
            href={`/${locale}/pricing`}
            className="inline-block mt-4 rounded-md bg-brand text-brand-ink font-semibold px-4 py-2 hover:bg-brand-hover transition-colors"
          >
            Resubscribe
          </Link>
        </section>
      )}

      {/* Other statuses (incomplete, unpaid, paused) — generic */}
      {status && !['active', 'trialing', 'past_due', 'canceled'].includes(status) && (
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground">Subscription status: {status}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your subscription via Stripe to resolve this status.
          </p>
          <ManageButton locale={locale} className="mt-6" />
        </section>
      )}
    </main>
  )
}
```

Confirm `auth` import path. If `@/lib/auth` doesn't expose `auth.api.getSession`, adapt to whatever the existing public pages (like `/[locale]/(public)/pricing/page.tsx`) use.

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
npm test
```

Both clean. Tests stay at 126.

- [ ] **Step 5: Dev smoke (light)**

If you have a dev environment ready:
1. Visit `/en/settings/billing` while signed in (free-tier) → "You're on the free tier" + See Premium CTA.
2. Without env vars set, the Manage button click would fail — that's fine for the smoke; just confirm the page renders.

If env not set or Stripe not configured, skip smoke; commit + move on.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(app)/settings/"
git commit -m "feat(billing): /settings/billing page (P8D Task 2)

Server component reads userBilling and renders one of 5 state branches:
free / active+trialing / past_due (warning) / canceled / other.
Hero status + plan + renewal date + Manage button (opens Stripe Portal
via P8A's createBillingPortalSessionAction).

ManageButton is a thin client component that handles loading + error.
Page uses dynamic='force-dynamic' so it always reflects the latest
userBilling state (no caching of subscription status)."
```

---

## Task 3: Book overflow soft-lock

**Files:**
- Create: `lib/billing/book-overflow.ts`
- Create: `app/[locale]/(app)/studio/[bookId]/_components/overflow-banner.tsx`
- Modify: `lib/actions/chapter.actions.ts`
- Modify: `lib/actions/binder.actions.ts`
- Modify: `app/[locale]/(app)/studio/[bookId]/page.tsx`
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` (mount the banner)

- [ ] **Step 1: Create the overflow helper**

```ts
// lib/billing/book-overflow.ts
import { db } from '@/db'
import { books } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getUserPremiumStatus, FREE_BOOK_LIMIT } from '@/lib/premium'

/**
 * Returns true when a non-premium user has more than FREE_BOOK_LIMIT books
 * AND the given book is one of the overflow books.
 *
 * Overflow is determined by createdAt ASC — the user's OLDEST FREE_BOOK_LIMIT
 * books remain active; subsequent books overflow. Choice rationale: stable
 * across edits (vs. updatedAt which would shift the overflow set on every
 * keystroke in a different book).
 *
 * Premium users always get false. The free-tier check is the only thing
 * that activates the soft-lock.
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
  if (index === -1) return false // book not found — caller will error elsewhere

  return index >= FREE_BOOK_LIMIT
}
```

- [ ] **Step 2: Gate `saveChapterAction`**

Read `lib/actions/chapter.actions.ts`. Find `saveChapterAction`. Add at the top of the handler:

```ts
import { isBookOverflow } from '@/lib/billing/book-overflow'

// Inside saveChapterAction, after requireAuth + before any DB write:
const bookId = /* extract from the chapter being saved — likely already in scope */
if (await isBookOverflow(userId, bookId)) {
  return { success: false, error: 'FREE_LIMIT_REACHED' }
}
```

Confirm the variable names for `userId` and `bookId` match the actual code. If the action receives a chapterId, you'll need to look up the bookId first (probably already done in the existing code).

- [ ] **Step 3: Gate binder action writes**

Read `lib/actions/binder.actions.ts`. For each WRITE action — likely:
- `createBinderItemAction`
- `updateBinderItemAction`
- `deleteBinderItemAction`
- `reorderBinderItemsAction`

Add the same overflow gate. The action receives a `bookId` (or computes one from the binder item), so the lookup is straightforward.

Skip read actions like `getBinderTreeAction` — reading is always allowed.

- [ ] **Step 4: Create the overflow banner component**

```tsx
// app/[locale]/(app)/studio/[bookId]/_components/overflow-banner.tsx
'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

export function OverflowBanner() {
  const params = useParams<{ locale: string }>()
  return (
    <div
      data-slot="overflow-banner"
      className="bg-brand/15 border-b border-brand/40 px-4 py-2 flex items-center justify-between gap-3"
    >
      <p className="text-sm text-foreground">
        This book is read-only because you&apos;re on the free tier.
        Upgrade to keep editing.
      </p>
      <Link
        href={`/${params.locale}/pricing`}
        className="text-xs font-semibold rounded-md bg-brand text-brand-ink px-3 py-1.5 hover:bg-brand-hover transition-colors shrink-0"
      >
        Upgrade
      </Link>
    </div>
  )
}
```

- [ ] **Step 5: Wire `bookOverflow` through to the editor**

Modify `app/[locale]/(app)/studio/[bookId]/page.tsx`:

```tsx
// Server component — compute bookOverflow once, pass into the editor tree.
const overflow = await isBookOverflow(session.user.id, bookId)

return (
  <BookEditorProvider /* ... */>
    {/* Pass overflow as a prop to whichever component mounts the banner */}
    <CorkboardOrEditor bookOverflow={overflow} />
    ...
  </BookEditorProvider>
)
```

The prop flows down to `chapter-editor.tsx` (likely via `corkboard-or-editor.tsx`). Adapt to the actual component tree — if the provider is the cleanest place to thread it, add it there.

OR: have the editor component fetch overflow status on its own via a small client-side query. Cleaner separation but adds a round-trip.

Recommend the server-prop path: compute once, thread through.

- [ ] **Step 6: Mount the banner in `chapter-editor.tsx`**

Find the chapter-render path in `chapter-editor.tsx`. Above the editor toolbar (or right under it, your call):

```tsx
import { OverflowBanner } from '../overflow-banner'

// In the chapter-render path:
{bookOverflow && <OverflowBanner />}
{editor && <EditorToolbar ... />}
...
```

The banner sits at the top of the editor pane, above the toolbar. Visible whenever the active book is overflow.

The TipTap editor should also enter read-only mode when overflow. Use `editor.setEditable(false)` if `bookOverflow` is true. There's existing precedent from the snapshot preview banner (DP4) which also sets the editor non-editable — use the same pattern.

- [ ] **Step 7: Type check + tests**

```bash
npx tsc --noEmit
npm test
```

Both clean. Tests stay at 126.

- [ ] **Step 8: Commit**

```bash
git add lib/billing/ "app/[locale]/(app)/studio/" lib/actions/
git commit -m "feat(billing): book overflow soft-lock (P8D Task 3)

Free-tier users with >FREE_BOOK_LIMIT books get the oldest 3 books
active; subsequent books become read-only.

Helper: lib/billing/book-overflow.ts — isBookOverflow(userId, bookId)
returns true when a non-premium user's book ranks beyond the limit by
createdAt ASC. Premium users always get false.

Gates applied at:
- lib/actions/chapter.actions.ts saveChapterAction
- lib/actions/binder.actions.ts {create, update, delete, reorder}BinderItemAction

UI: OverflowBanner above the editor toolbar shows brand-yellow tint
+ Upgrade CTA. TipTap editor is set to non-editable (same pattern as
DP4 snapshot preview banner) so users can't even type.

createdAt ASC choice: stable across edits. Alternative would be
updatedAt DESC but that rotates the overflow set every keystroke."
```

---

## Task 4: Hive invite gate + AGENTS.md + push

**Files:**
- Possibly modify: `lib/actions/hive.actions.ts` (verify gates exist; per P8C audit they do, but confirm)
- Modify: `AGENTS.md`

- [ ] **Step 1: Audit hive invite/join gates**

Read `lib/actions/hive.actions.ts`. Per P8C Task 3 audit, the existing `inviteAction` (or whatever the function is named) and `joinHiveByLinkAction` already check the OWNER's premium status + member count against `FREE_HIVE_MEMBER_LIMIT`.

Confirm both still return `{ success: false, error: 'FREE_LIMIT_REACHED' }` when over limit. Read the code.

If a gate is missing on either action, add it. If both already exist, no code change needed.

- [ ] **Step 2: Verify the hive UI surfaces the error**

Find where the invite UI calls the action. Confirm that a `FREE_LIMIT_REACHED` error is rendered as an upsell-style toast or inline message. The toast system from DP4 handles this naturally — the calling component reads the error and shows it.

If the UI swallows the error silently, fix it. Likely already correct.

- [ ] **Step 3: Run final automated checks**

```bash
npx tsc --noEmit
npm test
```

Both clean. Tests should still be 126.

- [ ] **Step 4: Update AGENTS.md**

Read `AGENTS.md`. Update Resume Here:
- Last updated: 2026-05-27
- Current focus: "Phase 8 COMPLETE. Stripe monetization fully shipped (P8A foundations → P8B pricing+checkout → P8C webhooks → P8D billing portal+downgrade)."
- Last commit: `git log -1 --format=%s` after AGENTS.md commit.
- Next concrete step: "Configure the Stripe dashboard webhook URL (subscribe to customer.subscription.{created,updated,deleted}, copy signing secret to Vercel env). Test the live flow with a real test-mode subscription. Then close out Phase 8 and plan Phase 9."

Add a P8D pattern entry to the Key Patterns block:

> **P8D billing/downgrade pattern:** `/settings/billing` renders one of 5 state branches based on `userBilling.subscriptionStatus`: free / active+trialing / past_due (warning) / canceled / other. ManageButton invokes `createBillingPortalSessionAction` (P8A). Soft-lock on overflow books: `isBookOverflow(userId, bookId)` from `lib/billing/book-overflow.ts` — non-premium users with >`FREE_BOOK_LIMIT` books get oldest 3 active, others read-only via the OverflowBanner + `editor.setEditable(false)`. createdAt ASC chosen for stability (updatedAt would shift overflow set on every keystroke). Hive invite/join actions block when current member count exceeds `FREE_HIVE_MEMBER_LIMIT` — existing members keep editing. `past_due` is treated as premium in `PREMIUM_STATUSES` so Stripe's grace period (~3 weeks of retries) preserves access.

Add a P8D entry under "What Has Been Built":

```markdown
### P8D — Billing Portal + Downgrade UX ✅ COMPLETE (2026-05-27)
Fourth and FINAL Phase 8 sub-project. Closes Phase 8.

- **`/settings/billing` page:** server component with 5 state branches (free / active+trialing / past_due / canceled / other). Hero status display + Manage button (opens Stripe Portal via P8A's createBillingPortalSessionAction). past_due shows a warning card; canceled shows "Subscription ended" + Resubscribe CTA.
- **Soft-lock for overflow books:** `lib/billing/book-overflow.ts::isBookOverflow(userId, bookId)`. Non-premium users with >FREE_BOOK_LIMIT books get the oldest 3 active; 4th+ become read-only. Gated at saveChapterAction + all binder write actions. OverflowBanner mounts in chapter-editor.tsx (brand-yellow band + Upgrade CTA); TipTap editor set to non-editable. createdAt ASC for stability.
- **Hive invite gate:** existing `inviteAction` + `joinHiveByLinkAction` already check member count vs FREE_HIVE_MEMBER_LIMIT — confirmed in P8C audit. Existing members in an over-limit hive keep editing; new invites/joins are blocked.
- **Premium semantics:** `PREMIUM_STATUSES` set in `lib/premium.ts` extended to `{active, trialing, past_due}`. Stripe's grace period (~3 weeks of payment retries) preserves access; once Stripe gives up the retry, the webhook flips status to 'canceled' and the user becomes free-tier.

No DB schema changes. Tests at 126 (+1 past_due test).

**Phase 8 (Stripe monetization) COMPLETE.** End-to-end flow:
- /pricing → Stripe Checkout → /welcome → subscription syncs via webhook → /settings/billing for management → Stripe Portal for plan changes/cancellation → downgrade triggers soft-lock if user is over free-tier limits.

**Post-deploy reminders:**
1. Configure Stripe dashboard webhook at `https://{prod}/api/webhooks/stripe`.
2. Subscribe to: `customer.subscription.{created,updated,deleted}`.
3. Copy signing secret → Vercel env `STRIPE_WEBHOOK_SECRET`.
4. Test the live flow with a real test-mode subscription.

**Next:** Phase 9 — TBD. Candidates: referral codes, growth analytics, plan-upgrade nudges, polish.
```

- [ ] **Step 5: Commit + push**

```bash
git add AGENTS.md lib/actions/hive.actions.ts 2>/dev/null
git add AGENTS.md
git commit -m "docs: close P8D + Phase 8 complete (Stripe monetization shipped)

Final Phase 8 sub-project. End-to-end subscription lifecycle:
buy → sync → manage → cancel → downgrade gracefully (soft-lock, no
data loss).

Past_due treated as premium for grace period coverage. Hive invites
gated at limit while existing members keep editing. Book overflow
soft-locked with read-only banner + non-editable TipTap.

Post-deploy: configure Stripe dashboard webhook URL — see Resume
Here for instructions.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"

git push origin main
```

---

## Definition of Done

- 4 atomic commits + AGENTS.md close-out commit (5 total).
- All 9 manual tests pass (spec §7).
- `tsc` clean. `npm test` clean (126 expected).
- Billing page renders all 5 state branches correctly.
- Manage button opens Stripe Portal + returns cleanly.
- Book overflow gate enforced at action layer + banner visible on overflow books.
- Hive invite gate confirmed working (existing or added).
- `past_due` honored as premium.
- AGENTS.md Resume Here + P8D entry + Phase 8 complete summary.
- Pushed to origin/main.

After P8D ships and Chris configures the Stripe dashboard webhook URL, Phase 8 is fully live.
