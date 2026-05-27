# P8B Pricing Page + Checkout Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public `/[locale]/pricing` page wired to P8A's `createCheckoutSessionAction`, route logged-out users through sign-up first, land a `/welcome` celebration page Stripe redirects to post-checkout.

**Architecture:** Four atomic tasks foundation-up. Pricing page first (the largest surface). Then sign-up `?next=` threading. Then welcome page + `success_url` update in billing actions. Then upsell-link audit + AGENTS.md close-out.

**Tech Stack:** Next.js 16 App Router (server components with ISR), better-auth (session reads), Stripe SDK (price fetch via P8A's client), Tailwind v4 + paper-context tokens from DP1-DP4.

**Spec:** [`docs/superpowers/specs/2026-05-27-p8b-pricing-checkout-design.md`](../specs/2026-05-27-p8b-pricing-checkout-design.md)

---

## File Structure

**New:**
- `app/[locale]/(public)/pricing/page.tsx`
- `app/[locale]/(public)/pricing/_components/plan-card.tsx`
- `app/[locale]/(public)/pricing/_components/feature-list.tsx`
- `app/[locale]/welcome/page.tsx` (or `app/[locale]/(public)/welcome/page.tsx` — confirm route group during impl)

**Modified:**
- `app/[locale]/(auth)/sign-up/_components/sign-up-form.tsx` (or wherever sign-up handles post-success routing)
- `lib/actions/billing.actions.ts` (`success_url` update)
- Possibly: middleware or onboarding components if `?next=` doesn't survive
- Possibly: studio components with bare `/pricing` hrefs (if any)
- `AGENTS.md`

**No DB changes. No new server actions. No new types. No new tests.** Manual verification per task.

---

## Task 1: Pricing page + plan card + feature list

**Files:**
- Create: `app/[locale]/(public)/pricing/page.tsx`
- Create: `app/[locale]/(public)/pricing/_components/plan-card.tsx`
- Create: `app/[locale]/(public)/pricing/_components/feature-list.tsx`

- [ ] **Step 1: Inspect public layout + auth helper**

Read `app/[locale]/(public)/layout.tsx` to understand the public route group's shell.

Confirm the auth helper pattern. Grep:
```bash
grep -rn "auth.api.getSession\|getServerSession\|auth\.session" lib/ app/ 2>&1 | head -5
```

Likely `auth.api.getSession({ headers: await headers() })` from better-auth. Use whatever existing server components use.

Verify env vars are loaded:
```bash
grep -E "STRIPE_PRICE_ID|STRIPE_SECRET" .env.example 2>&1 | head -5
```

If `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_ANNUAL` aren't set in `.env.local`, the Stripe price fetch will fail. Chris will need real test-mode price IDs from his Stripe dashboard before this task is fully verifiable. Document in the commit message.

- [ ] **Step 2: Build the FeatureList component (smallest, no state)**

```tsx
// app/[locale]/(public)/pricing/_components/feature-list.tsx
import { Check } from 'lucide-react'

const PREMIUM_FEATURES = [
  {
    title: 'Never lose a draft',
    body: 'Auto-saved versions of every chapter, restorable at a click.',
  },
  {
    title: 'Publish your book to the world',
    body: 'Polished publishing details — ISBN, subtitle, dedication, and more.',
  },
  {
    title: 'Build your library',
    body: 'Unlimited books — write as many as you can dream up.',
  },
  {
    title: 'Grow your circle',
    body: 'Unlimited Hives, larger groups, your full writing community.',
  },
]

export function FeatureList() {
  return (
    <ul className="flex flex-col gap-4">
      {PREMIUM_FEATURES.map((f) => (
        <li key={f.title} className="flex items-start gap-3">
          <span
            className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0"
            style={{
              background: 'oklch(from var(--color-brand) l c h / 0.18)',
              color: 'var(--color-brand)',
            }}
          >
            <Check size={14} strokeWidth={2.5} />
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">{f.title}</span>
            <span className="text-xs text-muted-foreground leading-relaxed">{f.body}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Build the PlanCard client component**

```tsx
// app/[locale]/(public)/pricing/_components/plan-card.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createCheckoutSessionAction } from '@/lib/actions/billing.actions'
import { FeatureList } from './feature-list'

type PriceInfo = {
  id: string
  amount: number     // cents
  currency: string   // 'usd' etc
}

type Props = {
  locale: string
  isAuthed: boolean
  monthly: PriceInfo
  annual: PriceInfo
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

export function PlanCard({ locale, isAuthed, monthly, annual }: Props) {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const annualMonthlyEquivalent = annual.amount / 12
  const savings = Math.round((1 - annualMonthlyEquivalent / monthly.amount) * 100)
  const isCurrentMonthly = cycle === 'monthly'
  const displayPriceCents = isCurrentMonthly ? monthly.amount : annualMonthlyEquivalent

  async function handleUpgrade() {
    if (loading) return
    setError(null)
    setLoading(true)
    const result = await createCheckoutSessionAction({ priceKey: cycle, locale })
    if (result.success) {
      window.location.href = result.data.url
    } else {
      setError(result.error)
      setLoading(false)
    }
  }

  const signUpHref = `/${locale}/sign-up?next=${encodeURIComponent(`/${locale}/pricing`)}`

  return (
    <div
      className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lg flex flex-col gap-6"
      data-slot="plan-card"
    >
      {/* Cycle toggle */}
      <div
        role="tablist"
        aria-label="Billing cycle"
        className="inline-flex rounded-full border border-border p-1 self-center"
      >
        <button
          role="tab"
          aria-selected={isCurrentMonthly}
          onClick={() => setCycle('monthly')}
          className={[
            'text-xs font-semibold px-4 py-1.5 rounded-full transition-colors',
            isCurrentMonthly
              ? 'bg-brand text-brand-ink'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          Monthly
        </button>
        <button
          role="tab"
          aria-selected={!isCurrentMonthly}
          onClick={() => setCycle('annual')}
          className={[
            'inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-full transition-colors',
            !isCurrentMonthly
              ? 'bg-brand text-brand-ink'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          Annual
          {savings > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: isCurrentMonthly
                  ? 'oklch(from var(--color-brand) l c h / 0.15)'
                  : 'var(--chrome-950)',
                color: isCurrentMonthly ? 'var(--color-brand)' : 'var(--color-brand)',
              }}
            >
              Save {savings}%
            </span>
          )}
        </button>
      </div>

      {/* Price */}
      <div className="text-center flex flex-col gap-1">
        <div className="flex items-baseline justify-center gap-1">
          <span
            className="text-5xl font-bold text-foreground"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
          >
            {formatPrice(displayPriceCents, monthly.currency)}
          </span>
          <span className="text-sm text-muted-foreground">/mo</span>
        </div>
        {!isCurrentMonthly && (
          <span className="text-xs text-muted-foreground">
            Billed annually ({formatPrice(annual.amount, monthly.currency)})
          </span>
        )}
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-2">
        {isAuthed ? (
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full rounded-md bg-brand text-brand-ink font-semibold py-3 hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {loading ? 'Preparing checkout…' : 'Upgrade to Premium'}
          </button>
        ) : (
          <Link
            href={signUpHref}
            className="w-full rounded-md bg-brand text-brand-ink font-semibold py-3 hover:bg-brand-hover transition-colors text-center"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Sign up to upgrade
          </Link>
        )}
        {error && (
          <p className="text-xs text-destructive text-center" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Feature list */}
      <FeatureList />

      {/* Free tier callout */}
      <p
        className="text-xs text-muted-foreground text-center border-t border-border pt-4 leading-relaxed"
      >
        Already on Beehive&apos;s free tier: 3 books, 3 hives, community access.
        Premium unlocks everything above.
      </p>
    </div>
  )
}
```

Tailwind class concatenation uses string array + `.join(' ')` if `cn` utility isn't imported here — use whichever the codebase pattern is.

The `text-brand-ink` and `bg-brand` utilities are already registered in @theme (DP1 + DP2 commit `d924543`).

- [ ] **Step 4: Build the pricing page server component**

```tsx
// app/[locale]/(public)/pricing/page.tsx
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { stripe } from '@/lib/stripe/client'
import { PlanCard } from './_components/plan-card'

export const revalidate = 3600 // ISR — refresh Stripe prices hourly

type Props = { params: Promise<{ locale: string }> }

export default async function PricingPage({ params }: Props) {
  const { locale } = await params

  // Fetch Stripe prices in parallel.
  let monthly: Awaited<ReturnType<typeof stripe.prices.retrieve>> | null = null
  let annual: Awaited<ReturnType<typeof stripe.prices.retrieve>> | null = null
  let priceError: string | null = null

  try {
    ;[monthly, annual] = await Promise.all([
      stripe.prices.retrieve(process.env.STRIPE_PRICE_ID_MONTHLY!),
      stripe.prices.retrieve(process.env.STRIPE_PRICE_ID_ANNUAL!),
    ])
  } catch (err) {
    priceError = err instanceof Error ? err.message : 'Failed to load pricing'
  }

  const session = await auth.api.getSession({ headers: await headers() })
  const isAuthed = !!session?.user

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 gap-10">
      <header className="text-center max-w-xl flex flex-col gap-3">
        <h1
          className="text-4xl font-bold text-foreground"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
        >
          Beehive Premium
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          Unlimited books. Version history. The full writer&apos;s workshop.
        </p>
      </header>

      {priceError || !monthly || !annual ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-center text-sm text-destructive max-w-md">
          Pricing is temporarily unavailable. Refresh in a moment, or
          <a href="mailto:support@beehive.studio" className="underline ml-1">contact support</a>.
        </div>
      ) : (
        <PlanCard
          locale={locale}
          isAuthed={isAuthed}
          monthly={{ id: monthly.id, amount: monthly.unit_amount ?? 0, currency: monthly.currency }}
          annual={{ id: annual.id, amount: annual.unit_amount ?? 0, currency: annual.currency }}
        />
      )}
    </main>
  )
}
```

Adapt `auth` import path to whatever the project uses (might be `@/lib/auth` or `@/lib/auth/instance`).

- [ ] **Step 5: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean. Tests stay at 121.

If Chris has `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_ANNUAL` in `.env.local`:
1. Boot dev server.
2. Visit `/en/pricing` → page renders with prices.
3. Toggle Monthly/Annual → price + sub-label flip.
4. "Save X%" badge present when annual selected.

If env vars are not set, the page shows the fallback error card. That's the correct behavior — note in commit that Chris needs to set them before clicking through to checkout.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(public)/pricing/"
git commit -m "feat(pricing): public /pricing page with monthly/annual toggle (P8B Task 1)

New /[locale]/pricing route under (public) — accessible without auth.
Fetches Stripe prices via P8A's client singleton with revalidate=3600
(hourly ISR). Renders fallback error card if Stripe fetch fails.

PlanCard client component handles the cycle toggle (monthly/annual),
dynamically computes the savings percentage from the prices, and:
- Logged-in users: clicking Upgrade invokes createCheckoutSessionAction
  and redirects to the Stripe URL.
- Logged-out users: CTA is a Link to /sign-up?next=/pricing.

FeatureList component holds the premium-feature copy with brand-y
framing (Never lose a draft, Publish your book to the world, etc.) —
no aspirational entries.

Free-tier callout pinned at the bottom of the card."
```

---

## Task 2: Sign-up `?next=` support

**Files:**
- Modify: `app/[locale]/(auth)/sign-up/_components/sign-up-form.tsx`
- Possibly: `app/[locale]/(auth)/sign-up/page.tsx` (if it controls redirects)
- Possibly: onboarding components if they intercept and strip `?next=`
- Possibly: middleware

- [ ] **Step 1: Read the existing sign-up flow**

Read these in order:
1. `app/[locale]/(auth)/sign-up/page.tsx` — note how it passes params.
2. `app/[locale]/(auth)/sign-up/_components/sign-up-form.tsx` — find the post-success redirect target.
3. `app/[locale]/(auth)/onboarding/_components/...` — find where onboarding completes and redirects.
4. `middleware.ts` (root) — find the onboarding gate.

Determine where the post-signup redirect happens. Common patterns:
- Sign-up form calls `router.push('/studio')` after success.
- Middleware redirects logged-in-but-not-onboarded users to `/onboarding`.
- Onboarding completion calls `router.push('/studio')`.

The `?next=` param must survive all three of these to land on `/pricing`.

- [ ] **Step 2: Add `next` parameter sanitization helper**

If a sanitizer already exists (`lib/utils.ts` etc.), use it. Otherwise add inline:

```ts
function safeNextPath(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  // Same-origin paths only: must start with /, no //, no ://
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//')) return fallback
  if (raw.includes('://')) return fallback
  return raw
}
```

Place in `lib/utils.ts` or alongside the sign-up form. Inline is fine for one-off.

- [ ] **Step 3: Thread `next` through sign-up**

In `sign-up-form.tsx`:

```tsx
import { useSearchParams, useRouter } from 'next/navigation'

const searchParams = useSearchParams()
const router = useRouter()
const next = safeNextPath(searchParams.get('next'), `/${locale}/studio`)

// In handleSubmit, after sign-up succeeds:
router.push(next)
```

Adapt to existing patterns — the form may use a `useTransition` callback or a server action. The key is that `next` is captured + passed through to whatever redirect happens at the end.

- [ ] **Step 4: Decide on onboarding flow**

Two paths:
1. **Pass `next` through onboarding** — onboarding gate appends `?next=` to its redirect URL; onboarding completion reads it and routes there.
2. **Accept the degradation** — first-time sign-up lands on `/studio` post-onboarding regardless of `?next=`. User re-clicks an upsell to get back to /pricing.

Path 2 is acceptable per spec §6 risk 4. Recommend Path 2 unless threading through onboarding is trivial:
- If middleware already preserves query params on redirect → no work, Path 1 is free.
- If middleware redirects with bare URL → Path 2 (do not modify middleware in this task).

Confirm during impl. Document the choice in the commit message.

- [ ] **Step 5: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual smoke:
1. Visit `/en/pricing` while logged out → click Upgrade → lands on `/en/sign-up?next=%2Fen%2Fpricing`.
2. The `next` param survives a page refresh.
3. Try a malicious next: `/en/sign-up?next=https://evil.com` → after sign-up, lands on `/studio` (fallback), NOT `https://evil.com`.

(Don't actually complete sign-up unless Chris has a test account flow — Step 6 of Task 4 will do end-to-end.)

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/(auth)/sign-up/" lib/utils.ts 2>/dev/null || git add "app/[locale]/(auth)/sign-up/"
git commit -m "feat(auth): sign-up ?next= parameter with sanitization (P8B Task 2)

Adds a safeNextPath() helper that validates 'next' query param is a
same-origin path (starts with /, no //, no protocol). Falls back to
/[locale]/studio if invalid or missing.

Sign-up form reads ?next= via useSearchParams; post-success redirect
honors the sanitized value.

Onboarding flow: [Path 1: threaded through OR Path 2: accepts the
first-time degradation per spec §6 risk 4]. Document the choice."
```

---

## Task 3: Welcome page + success_url update

**Files:**
- Create: `app/[locale]/welcome/page.tsx` (or `(public)/welcome` — confirm)
- Modify: `lib/actions/billing.actions.ts`

- [ ] **Step 1: Decide welcome page route group**

The welcome page renders post-checkout. The user IS logged in (Stripe Checkout requires the user be authed to start; their session persists through the redirect roundtrip). Two options:

- `app/[locale]/welcome/page.tsx` (no route group — applies the locale layout but not (app) or (public)).
- `app/[locale]/(app)/welcome/page.tsx` (inside the auth-required app group).

Recommend the SECOND — `(app)/welcome` — because we know the user is authenticated post-checkout. If their session has expired, redirecting them to sign-in is appropriate.

If `(public)` makes more sense (e.g., the layout is simpler), use that — but adapt the design accordingly (don't read session info).

- [ ] **Step 2: Build the welcome page**

```tsx
// app/[locale]/(app)/welcome/page.tsx
import Link from 'next/link'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ session_id?: string }>
}

export default async function WelcomePage({ params, searchParams }: Props) {
  const { locale } = await params
  await searchParams // we don't actually need session_id for v1, but await for the type contract

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 gap-8">
      <div className="text-center max-w-md flex flex-col items-center gap-4">
        {/* Decorative element — small brand-yellow hexagon or sparkles */}
        <div
          className="w-16 h-16 rounded-full inline-flex items-center justify-center"
          style={{
            background: 'oklch(from var(--color-brand) l c h / 0.18)',
            color: 'var(--color-brand)',
            fontFamily: 'var(--font-display)',
            fontSize: 32,
            fontWeight: 700,
          }}
          aria-hidden
        >
          ✦
        </div>
        <h1
          className="text-3xl font-bold text-foreground"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
        >
          Welcome to Premium
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          Your subscription is active. Time to get back to writing.
        </p>
        <Link
          href={`/${locale}/studio`}
          className="rounded-md bg-brand text-brand-ink font-semibold px-6 py-3 hover:bg-brand-hover transition-colors mt-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Open the studio
        </Link>
      </div>
    </main>
  )
}
```

Page is intentionally dumb — no DB read, no entitlement check. P8C will sync the actual `subscriptionStatus`; for the brief gap between checkout completion and webhook firing, the page is generic-celebratory.

- [ ] **Step 3: Update success_url in billing.actions.ts**

Find the existing `success_url` line:

```ts
success_url: `${baseUrl}/${args.locale}/settings/billing?checkout=success`,
```

Change to:

```ts
success_url: `${baseUrl}/${args.locale}/welcome?session_id={CHECKOUT_SESSION_ID}`,
```

The literal `{CHECKOUT_SESSION_ID}` is replaced by Stripe server-side with the session ID. Do NOT interpolate with a JS template variable.

Keep `cancel_url` unchanged.

- [ ] **Step 4: Type check + dev smoke**

```bash
npx tsc --noEmit
npm test
```

Both clean.

Manual smoke:
1. Visit `/en/welcome` directly (no session_id) → page renders with generic celebration.
2. Visit `/en/welcome?session_id=foo` → page still renders (session_id ignored in v1).
3. Click "Open the studio" → lands on `/en/studio`.

End-to-end checkout test happens in Task 4.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(app)/welcome/" "lib/actions/billing.actions.ts" 2>/dev/null || git add "app/[locale]/welcome/" "lib/actions/billing.actions.ts"
git commit -m "feat(billing): welcome page + success_url points at /welcome (P8B Task 3)

New /[locale]/welcome celebration page renders after Stripe checkout
returns. Brand-yellow accent + Comfortaa headline + CTA to studio.
Generic — does not depend on entitlement being synced (P8C wires
that). If a user lands on /welcome without completing checkout, the
page is harmless.

billing.actions.ts updated: success_url now points at
/[locale]/welcome?session_id={CHECKOUT_SESSION_ID} (Stripe expands
the placeholder server-side). Was /settings/billing in P8A — that
page doesn't exist yet (P8D ships it)."
```

---

## Task 4: Upsell-link audit + AGENTS.md + push

**Files:**
- Possibly: studio components with bare `/pricing` hrefs (audit grep first)
- Modify: AGENTS.md

- [ ] **Step 1: Audit upsell hrefs**

```bash
grep -rn "\"/pricing\"\|'/pricing'\|pricing\"" "app/[locale]/(app)/studio/" "app/[locale]/(app)/community/" 2>&1 | head -20
```

For each match, verify the href is locale-prefixed (`/${locale}/pricing`, not bare `/pricing`).

Common offenders to expect:
- `editor/version-history-drawer.tsx` — Premium upsell card (free-tier path).
- `metadata/metadata-panel.tsx` — Publishing details upsell.

Fix any bare hrefs by adding the locale prefix.

- [ ] **Step 2: End-to-end manual test (the big one)**

Requires `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL` set in `.env.local`. Chris must have real Stripe test-mode price IDs from his dashboard.

1. Boot dev. Sign out.
2. Visit `/en/pricing` → page renders with prices.
3. Click Upgrade → redirect to `/en/sign-up?next=%2Fen%2Fpricing`.
4. Complete sign-up (use a fresh test email).
5. Land on either `/en/pricing` (if Task 2 Path 1) or `/en/studio` (if Path 2 + onboarding).
6. If on /studio, navigate back to /pricing manually. Click Upgrade.
7. (Logged in) → action runs, redirects to Stripe Checkout.
8. Use Stripe test card `4242 4242 4242 4242` with any future expiry + any 3-digit CVC.
9. Stripe redirects to `/en/welcome?session_id=cs_test_...`.
10. Welcome page renders. Click "Open the studio".
11. Land on `/en/studio`. Premium is NOT yet active (P8C webhook scaffold is no-op) — expected.
12. Sign out. Test malicious next: `/en/sign-up?next=https://evil.com` → after creating another user, lands on `/studio` (sanitization works).

If any step fails, fix before Step 3.

- [ ] **Step 3: Update AGENTS.md**

Read `AGENTS.md`. Update Resume Here:
- Last updated: 2026-05-27
- Current focus: "P8B Pricing page + checkout flow complete; P8C Webhooks + entitlement next."
- Last commit: `git log -1 --format=%s` after AGENTS.md commit.
- Next concrete step: "invoke /brainstorming for P8C Webhooks + entitlement — wire real handler logic in /api/webhooks/stripe, sync subscriptionStatus from Stripe events, audit existing premium-gated server actions."

Add a P8B pattern entry alongside existing ones:

> **P8B pricing pattern:** Public `/[locale]/pricing` page fetches Stripe prices server-side with `revalidate: 3600` ISR. PlanCard client component handles the monthly/annual toggle + dynamically computed savings percentage. Logged-in users invoke `createCheckoutSessionAction` and redirect to Stripe; logged-out users go to `/sign-up?next=/pricing` (sanitized via `safeNextPath`). Stripe success_url points at `/[locale]/welcome` (P8B-shipped celebration page). Until P8C wires real webhook handlers, paid users are technically not premium until P8C catches up — Stripe retries events for up to 3 days.

Add a P8B entry under "What Has Been Built":

```markdown
### P8B — Pricing Page + Checkout Flow ✅ COMPLETE (2026-05-27)
Second of four Phase 8 sub-projects.

- **`/[locale]/pricing` page** (public, ISR `revalidate=3600`): single Premium tier with monthly/annual toggle pill. Prices fetched live from Stripe; "Save X%" badge computed dynamically. Premium feature list with brand-y framing (Never lose a draft, Publish your book, Build your library, Grow your circle). Free-tier callout pinned below.
- **CTA flow:** logged-in users → `createCheckoutSessionAction` → Stripe-hosted Checkout. Logged-out users → `/sign-up?next=/[locale]/pricing` (sanitized via `safeNextPath` — same-origin paths only; rejects protocol-prefixed or double-slash inputs).
- **`/[locale]/welcome` page:** post-checkout celebration. Brand-yellow accent, Comfortaa "Welcome to Premium", CTA to studio. Does not read DB — generic and webhook-independent.
- **`success_url` updated** in billing.actions.ts: was `/settings/billing?checkout=success` (placeholder), now `/welcome?session_id={CHECKOUT_SESSION_ID}` (Stripe expands the placeholder server-side).
- **Onboarding `?next=` handling:** [Path 1 threaded through OR Path 2 first-time degradation accepted].
- **Upsell hrefs in studio** audited and confirmed locale-prefixed.

No DB changes. No new server actions. 121/121 tests pass.

**Next:** P8C — wire real webhook handlers for `customer.subscription.{created,updated,deleted}` + `invoice.{paid,payment_failed}`. Sync `userBilling.subscriptionStatus`, `stripeSubscriptionId`, `currentPeriodEnd`. Audit existing premium-gated server actions.
```

- [ ] **Step 4: Commit AGENTS.md + push**

```bash
git add AGENTS.md
git commit -m "docs: close P8B Pricing + Checkout (Phase 8 second sub-project shipped)

End-to-end checkout flow now works:
- Anonymous visitor → /pricing → sign-up redirect → Stripe Checkout
  → /welcome celebration → /studio.
- Premium entitlement doesn't sync until P8C wires real webhook
  handlers (webhook scaffold from P8A still no-op). Stripe retries
  events for up to 3 days, so P8C will catch up retroactively.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"

git push origin main
```

---

## Definition of Done

- 4 atomic commits + AGENTS.md close-out (5 total).
- All 13 manual checks pass (spec §7).
- `npx tsc --noEmit` clean.
- `npm test` clean (still 121).
- `/[locale]/pricing` renders with real Stripe prices (ISR).
- Logged-out CTA goes to `/sign-up?next=/pricing` (sanitized).
- Logged-in CTA invokes checkout and redirects to Stripe.
- `/[locale]/welcome` celebrates post-checkout return.
- `success_url` in billing.actions.ts updated.
- Studio upsell hrefs all locale-prefixed.
- AGENTS.md Resume Here + P8B entry.
- Pushed to origin/main.
