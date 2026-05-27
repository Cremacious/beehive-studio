# P8B — Pricing Page + Checkout Flow Design Spec

> **Date:** 2026-05-27
> **Sub-project:** Phase 8B — second of four Phase 8 sub-projects.
> **Status:** Design approved; pending implementation plan.

---

## 1. Goal

Build the public `/[locale]/pricing` page (currently 404 — referenced by upsell CTAs throughout the studio). Wire it to the `createCheckoutSessionAction` shipped in P8A so logged-in users can buy subscriptions. Route logged-out users through sign-up first. Land a `/welcome` celebration page that Stripe redirects to after successful checkout.

After P8B, paying users can complete an end-to-end purchase. The webhook still no-ops (P8C wires real entitlement sync), so users who pay during the gap will technically not be marked premium until P8C ships — Stripe events queue and Stripe retries failed webhook deliveries for up to 3 days, so P8C catches them up retroactively if shipped within that window.

## 2. Context

Phase 8 decomposition:
- ✅ P8A Foundations
- **P8B Pricing page + checkout flow** (this spec)
- P8C Webhooks + entitlement
- P8D Billing portal + downgrade UX

P8A shipped: Stripe SDK + client singleton, schema extensions, two server actions (`createCheckoutSessionAction`, `createBillingPortalSessionAction`), webhook endpoint scaffold at `/api/webhooks/stripe`. The success URL on Checkout Sessions currently points at `/[locale]/settings/billing?checkout=success` (placeholder that doesn't exist yet — P8B updates it to `/[locale]/welcome`).

Locked decisions from the brainstorm:
1. Single Premium tier, monthly/annual toggle pill.
2. Logged-out users redirected to sign-up with `?next=/pricing`.
3. Premium feature list with brand-y framing + small free-tier callout.
4. Dedicated `/[locale]/welcome` celebration page (built in P8B, survives post-P8D).
5. Stripe Prices fetched at request time with `revalidate: 3600` ISR.
6. "Save X%" percentage badge, computed dynamically from prices.
7. Real features with brand-y framing — no aspirational "coming soon" entries.

## 3. Non-goals

- Real entitlement sync from webhooks — P8C handles that.
- Settings → Billing page — P8D handles that.
- Multiple tiers (Free / Pro / Studio) — out of MVP scope.
- Promo codes / discount codes UX — `allow_promotion_codes` is already true on the Checkout session; Stripe's own page handles entry.
- Free trials.
- Tax handling display (Stripe Checkout handles taxes per the connected account's settings).
- Comparison with competitors.
- Testimonials, social proof, FAQ sections — out of MVP; can be added post-launch as a follow-up if conversion needs lift.

## 4. Architecture

### 4.1 Page composition

`/[locale]/pricing/page.tsx` — server component, public route group:

```tsx
import { stripe } from '@/lib/stripe/client'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { PlanCard } from './_components/plan-card'

export const revalidate = 3600 // ISR — refetch prices hourly

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  const [monthly, annual] = await Promise.all([
    stripe.prices.retrieve(process.env.STRIPE_PRICE_ID_MONTHLY!),
    stripe.prices.retrieve(process.env.STRIPE_PRICE_ID_ANNUAL!),
  ])

  const session = await auth.api.getSession({ headers: await headers() })
  const isAuthed = !!session?.user

  return (
    <main className="...">
      <header>
        <h1>Beehive Premium</h1>
        <p>Unlimited books. Snapshots. The full writer's workshop.</p>
      </header>
      <PlanCard
        locale={locale}
        isAuthed={isAuthed}
        monthly={{ id: monthly.id, amount: monthly.unit_amount!, currency: monthly.currency }}
        annual={{ id: annual.id, amount: annual.unit_amount!, currency: annual.currency }}
      />
    </main>
  )
}
```

(`auth.api.getSession` is the better-auth pattern — confirm during impl.)

### 4.2 PlanCard client component

`pricing/_components/plan-card.tsx`:

- State: `cycle: 'monthly' | 'annual'` (default 'monthly'), `loading: boolean`.
- Toggle pill: two buttons; active uses brand-yellow.
- Price display: large Comfortaa numeric + `/mo` (always — even for annual, displays as monthly equivalent), small "Billed annually" sub-label when annual.
- "Save X%" badge on the annual side of the toggle. Computed:
  ```ts
  const savings = Math.round((1 - (annual.amount / 12) / monthly.amount) * 100)
  ```
- Feature list (FeatureList component): bullet rows with check icons.
- Free-tier callout below: "Already on Beehive's free tier: 3 books, 3 hives, community access. Premium unlocks everything below."
- CTA button:
  - `isAuthed === true` → `onClick` invokes `createCheckoutSessionAction({ priceKey: cycle, locale })` → `window.location.href = url`.
  - `isAuthed === false` → button is a `<Link>` to `/${locale}/sign-up?next=/${locale}/pricing`.
  - Loading state while the action is in-flight.
  - Error state if action returns `{ success: false }` — show inline message; do NOT auto-retry.

### 4.3 FeatureList component

`pricing/_components/feature-list.tsx`:

Pure presentational. Hard-coded feature data:

```ts
const PREMIUM_FEATURES = [
  { title: 'Never lose a draft', body: 'Auto-saved versions of every chapter, restorable at a click.' },
  { title: 'Publish your book to the world', body: 'Polished publishing details — ISBN, subtitle, dedication, and more.' },
  { title: 'Build your library', body: 'Unlimited books — write as many as you can dream up.' },
  { title: 'Grow your circle', body: 'Unlimited Hives, larger groups, your full writing community.' },
]
```

Brand-y framing per Q7 lock. No "coming soon" items.

### 4.4 Welcome page

`/[locale]/welcome/page.tsx` — server component, public route group OR app group:

- Reads `session_id` query param if present (Stripe expands `{CHECKOUT_SESSION_ID}` in the success URL).
- Renders generic celebration UI (does NOT depend on entitlement being synced):
  - Comfortaa "Welcome to Premium" headline.
  - 1-2 line body ("Your subscription is active. Get back to writing.").
  - Primary CTA: "Open the studio" → `/[locale]/studio`.
- Optional decorative element (small bee, sparkles, brand-yellow accent).
- Does NOT read `userBilling.subscriptionStatus` — the webhook may not have synced yet. Generic celebration is enough.

If the user lands on `/welcome` without a `session_id` query param (e.g., direct URL access), still render the same UI — it's harmless.

### 4.5 Sign-up `?next=` support

`(auth)/sign-up/_components/sign-up-form.tsx`:

- Read `next` query param: `const next = searchParams.get('next')` (via `useSearchParams`).
- Sanitize: only accept paths starting with `/`, not containing `//`, not containing `:`.
- On successful sign-up + onboarding completion, push to `next` value if valid; otherwise default to `/${locale}/studio`.

If the onboarding flow has its own redirect logic (separate `onboarding/_components/...`), thread `next` through it. Likely it's a query param or a cookie.

If middleware intercepts `/sign-up` → `/onboarding` for not-yet-onboarded users, confirm middleware preserves the `next` param.

### 4.6 success_url update in billing.actions.ts

P8A wired `success_url: '${baseUrl}/${locale}/settings/billing?checkout=success'`. Update to:

```ts
success_url: `${baseUrl}/${args.locale}/welcome?session_id={CHECKOUT_SESSION_ID}`,
```

Note the literal `{CHECKOUT_SESSION_ID}` — Stripe replaces this server-side with the actual session ID. Do NOT use JS template-string interpolation.

`cancel_url` stays as-is (`/[locale]/pricing?checkout=cancel`).

### 4.7 Upsell link audit

Studio components reference `/[locale]/pricing` as href (per AGENTS.md commit `d2d0a3f`). Quick verification during impl:

```bash
grep -rn "/pricing" "app/[locale]/(app)/studio/" 2>&1
```

Confirm all references use the correct locale-prefixed path (`/${locale}/pricing`, not bare `/pricing`).

## 5. Files

**New:**
- `app/[locale]/(public)/pricing/page.tsx`
- `app/[locale]/(public)/pricing/_components/plan-card.tsx`
- `app/[locale]/(public)/pricing/_components/feature-list.tsx`
- `app/[locale]/welcome/page.tsx` (placement TBD between `(public)` and `(app)` groups — confirm during impl based on auth requirements)

**Modified:**
- `app/[locale]/(auth)/sign-up/_components/sign-up-form.tsx` — `?next=` support
- `lib/actions/billing.actions.ts` — `success_url` points to `/welcome`
- Possibly: middleware or onboarding components if `?next=` doesn't survive
- Possibly: studio components with `/pricing` hrefs if any are wrong

**No DB changes. No new server actions. No new types.**

**No new tests required** — UI integration; manual verification.

## 6. Risks

1. **Stripe price fetch fails at build/render time.** If `STRIPE_SECRET_KEY` is unset or invalid, `stripe.prices.retrieve()` throws and the page errors. Wrap in try/catch; render a fallback ("Pricing temporarily unavailable. Refresh in a moment, or [contact support]"). Better than 500. Document in code.

2. **ISR revalidation lag.** Up to 1h of stale pricing if changed in Stripe dashboard. Acceptable for low-churn pricing.

3. **`?next=` open redirect.** Validate same-origin path before redirecting. Standard sanitization — reject anything with `:` or starting with `//`.

4. **Onboarding gate strips `?next=`.** If the auth middleware redirects to `/onboarding`, the param may be lost. Solutions:
   - Middleware preserves `next` by including it in the onboarding redirect URL.
   - OR: accept the first-time flow lands on `/studio`; user re-clicks an upsell. Acceptable degradation.
   Confirm during impl which path the project takes.

5. **Welcome page renders before webhook syncs.** Stripe Checkout completes → success_url redirects to `/welcome` → P8C webhook may not have fired yet. The `/welcome` page is dumb (no DB read) so this is fine. P8C will sync entitlement; for users who completed checkout during the P8B-only window, P8C must run a Stripe-events backfill (or rely on Stripe's retry within 3 days).

6. **Multiple sign-up redirects.** A user clicks Upgrade → sign-up. They complete onboarding which redirects to `/studio` (if `?next=` lost). They click an upsell again → /pricing. Click Upgrade → checkout. Acceptable two-click flow per Q2 lock.

7. **Currency hardcoded to USD.** P8A doesn't specify currency; the price IDs in Stripe dashboard are USD. If we ever offer EUR/GBP, this design needs revisit. Note in code for future.

## 7. Testing (manual)

1. Anonymous visit to `/en/pricing` → page renders. Monthly active by default.
2. Toggle to Annual → price flips to annual amount; "Save X%" badge shows; "Billed annually" sub-label appears.
3. Click "Upgrade" → redirects to `/en/sign-up?next=/en/pricing`.
4. Complete sign-up + onboarding → lands on `/en/pricing` (or `/en/studio` if onboarding strips next — log the result).
5. (Logged in, on pricing) Click "Upgrade" → calls action → redirects to Stripe Checkout.
6. Complete with test card → Stripe redirects to `/en/welcome?session_id=cs_...`.
7. Welcome page renders celebration UI. CTA → `/en/studio`.
8. Premium status: NOT yet synced because P8C webhook is no-op. Document the expected gap.
9. Click Cancel in Stripe → returns to `/en/pricing?checkout=cancel`.
10. Studio upsells (Version history drawer Premium CTA, etc.) → land on `/en/pricing` (not 404).
11. `npx tsc --noEmit` clean. `npm test` clean (still 121).
12. Verify `?next=/en/pricing` works (replace with arbitrary safe path to confirm sanitization).
13. Try malicious `?next=https://evil.com` → ignored; defaults to `/studio`.

## 8. Definition of Done

- 4 atomic commits + AGENTS.md close-out commit (5 total).
- All 13 manual checks pass.
- `tsc` clean. `npm test` clean (still 121).
- Stripe Prices fetched + cached.
- Welcome page renders independent of webhook sync.
- Sign-up `?next=` sanitized + threaded through onboarding flow.
- `success_url` in billing.actions.ts updated.
- Upsell hrefs in studio confirmed.
- AGENTS.md Resume Here + P8B entry.
- Pushed to origin/main.

## 9. Next sub-projects (informational)

- **P8C:** Real webhook handler logic. Subscribe to events (created/updated/deleted, invoice.paid/payment_failed), sync `userBilling.subscriptionStatus` + `stripeSubscriptionId` + `currentPeriodEnd`, idempotency via Stripe event ID dedupe. Audit existing premium-gated server actions for correctness. CONFIGURE the Stripe dashboard webhook URL only after this ships.
- **P8D:** Settings → Billing page wired to `createBillingPortalSessionAction`. Downgrade soft-lock when premium loss pushes user >3 books / >3 hives.
