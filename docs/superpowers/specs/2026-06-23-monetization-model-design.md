# Monetization Model — Design Spec (Issue #38)

> Status: approved in brainstorm 2026-06-23. Awaiting Chris's spec review before implementation plan.

## Goal

Ship the full monetization model for Beehive Studio: a redesigned pricing page, a polished in-app upgrade path across every premium gate, a verified Stripe flow that a brand-new user can complete end-to-end in the dev sandbox, conversion analytics, and a single editable config file for all free/premium limits.

Build **on top of** the existing P8A–P8D Stripe infrastructure (checkout, webhooks, entitlement, billing portal, soft-lock downgrade). This work is largely presentational + configuration on top of enforcement that already exists. Server-side `requirePremium` / `FREE_LIMIT_REACHED` enforcement stays intact.

## Locked decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Tier structure | **Free vs Premium only** (matches existing single-tier infra, no schema change) |
| Price points | **$7.99/mo · $59.99/yr** (save 37%, ~$5/mo effective) |
| Trial | **No trial** — the existing generous free tier is the funnel |
| Prompt style | **Inline pill → compact modal on click** (calm, contextual, never blocks) |
| Lead features | **Unlimited books · Version history · Unlimited hive members** |
| Writing Analysis | **Gate it as Premium** (currently free; becomes a premium surface — pre-launch, no live free users harmed) |
| Rollout scope | **All 7 gate surfaces** (refactor existing import-upsell + version-history card to the shared components) |
| Analytics | **Stub `trackEvent`** (console in dev, no-op in prod, swappable later) |
| Future AI framing | **Subtle one-liner** ("AI writing tools coming soon") — no overpromising |

### Cost rationale (for the record)
Fixed infra floor ~$21/mo (Vercel Pro + domain; Neon/Upstash/Cloudinary/Resend start free), growth tier ~$60/mo (Cloudinary free→$89 is the main scaling cliff). Stripe takes 2.9% + $0.30/charge. App-store IAP (future mobile) takes 15–30%. $7.99/mo nets ~$7.45 via web Stripe and ~$5.59 even at IAP 30% — comfortably above the tiny per-user marginal cost. Annual at 37% off maximizes cash flow and minimizes payment-fee drag. Mobile IAP-vs-link-out is **out of scope** for #38 (web path only); pricing was chosen to survive the eventual app-store cut so no re-pricing is forced later.

## Premium gate inventory (the real 7)

The issue named 5; audit found 7. All keep their existing server-side enforcement.

| # | Gate key | Enforcement (unchanged) | Current UX → becomes |
|---|---|---|---|
| 1 | `book-limit` | `createBookAction` → `FREE_LIMIT_REACHED` | generic error → UpgradePrompt |
| 2 | `version-history` | `snapshot.actions.ts` → `PREMIUM_REQUIRED` | drawer upsell card → shared UpgradePrompt |
| 3 | `publishing` | `publishing.actions.ts` → `PREMIUM_REQUIRED` | gated section → UpgradePrompt |
| 4 | `hive-members` | `hive.actions.ts` → `FREE_LIMIT` (hive count + member count) | generic error → UpgradePrompt |
| 5 | `overflow` | `lib/billing/book-overflow.ts` soft-lock | banner → restyled banner using shared copy |
| 6 | `import` | `import.actions.ts` → `PREMIUM_REQUIRED:import` | `import-upsell.tsx` → refactor to shared UpgradePrompt |
| 7 | `writing-analysis` | **none today — NEW gate to add** | none → gate + UpgradePrompt |

## Architecture

### 1. Single editable limits config — `lib/plans/limits.ts`
The one file Chris edits to change any free/premium limit. Pure data, heavily commented, no imports from app code.

```ts
// lib/plans/limits.ts
// SINGLE SOURCE OF TRUTH for every free vs premium limit.
// Edit the numbers/booleans here to change what each tier gets. Nothing else.

export const PLAN_LIMITS = {
  free: {
    books: 3,            // max active books
    hives: 3,            // max hives owned
    hiveMembers: 5,      // max members per hive
    versionHistory: false,
    publishingMetadata: false,
    bookImport: false,
    writingAnalysis: false,
  },
  premium: {
    books: Infinity,
    hives: Infinity,
    hiveMembers: Infinity,
    versionHistory: true,
    publishingMetadata: true,
    bookImport: true,
    writingAnalysis: true,
  },
} as const

// Display-only pricing fallback (authoritative numbers come live from Stripe).
// Used for SSR fallback copy + the savings-% sanity check.
export const PRICING_DISPLAY = {
  monthlyUsd: 7.99,
  annualUsd: 59.99,
  currency: 'usd',
} as const
```

`lib/premium.ts` re-derives its existing exports from this file so the ~33 existing import sites keep working unchanged:

```ts
import { PLAN_LIMITS } from '@/lib/plans/limits'
export const FREE_BOOK_LIMIT = PLAN_LIMITS.free.books
export const FREE_HIVE_LIMIT = PLAN_LIMITS.free.hives
export const FREE_HIVE_MEMBER_LIMIT = PLAN_LIMITS.free.hiveMembers
```

The `get*LimitForTier` helpers in `lib/premium.ts` are rewritten to read `PLAN_LIMITS[tier]` so they too track the config.

### 2. Feature/copy registry — `lib/upgrade/feature-registry.ts`
Pure data. Maps each gate key → display copy so the pill, modal, and pricing page never drift.

```ts
export type GateKey =
  | 'book-limit' | 'version-history' | 'publishing'
  | 'hive-members' | 'overflow' | 'import' | 'writing-analysis'

export const FEATURE_COPY: Record<GateKey, { title: string; benefit: string; icon: LucideIcon }>
// e.g. 'book-limit' → { title: 'Unlimited books', benefit: 'Write as many books as you want.', icon: BookOpen }

// Ordered list for the modal + pricing page. Lead 3 first.
export const PREMIUM_BENEFITS: Array<{ title: string; description: string; icon: LucideIcon }>
// Unlimited books, Version history, Unlimited hive members, then Publishing metadata,
// Book/chapter import, Writing analysis, Priority support.
```

The pricing comparison table reads its Free-column numbers from `PLAN_LIMITS.free` (so "3 books" / "5 members" auto-track the config). No em-dashes in any copy.

### 3. Pricing data helper — `lib/upgrade/pricing-data.ts`
Centralizes the Stripe monthly+annual price fetch and the dynamic savings-% math (currently inline in `pricing/page.tsx`). Returns `{ monthly, annual, savingsPct } | { error }`. Reused by `/pricing` and (later) #41's homepage preview — keeps both conflict-free.

### 4. Analytics — `lib/analytics/track-event.ts`
```ts
export function trackEvent(name: string, props?: Record<string, unknown>): void
// dev: console.debug('[track]', name, props); prod: no-op (TODO: swap for PostHog/Vercel).
```
Events fired: `upgrade_prompt_shown` (pill mount), `upgrade_modal_opened` (modal open), `checkout_started` (CTA click), `checkout_completed` (`/welcome` mount).

### 5. Shared upgrade components — `components/upgrade/`
- `upgrade-prompt.tsx` (client): inline pill. Props `{ feature: GateKey, className? }`. Renders brand-yellow "Upgrade to Premium" pill + the registry benefit line. Fires `upgrade_prompt_shown` once on mount. Click → opens `<UpgradeModal>`.
- `upgrade-modal.tsx` (client, shadcn Dialog): panel chrome. Feature-specific headline (from `FEATURE_COPY[feature]`) + `PREMIUM_BENEFITS` checklist + price line ($7.99/mo · $59.99/yr) + brand-yellow "Upgrade now" CTA + "See all plans" link → `/pricing`. "Upgrade now": authed → `createCheckoutSessionAction` (fires `checkout_started`); unauthed → `/sign-up?next=/pricing`. Fires `upgrade_modal_opened`.

shadcn Dialog already carries the chrome (per Design System). Brand-yellow restricted to the CTA + pill per the restraint map.

### 6. Gate integrations
Each gate swaps its raw error/disabled state for `<UpgradePrompt feature="…" />`. No change to server enforcement.
- **Writing Analysis (new gate):** thread `isPremium` from the studio page → `BookEditorProvider` context (mirrors the existing `bookOverflow` thread). Toolbar Analytics click: free → render UpgradePrompt in the panel slot; premium → render `<WritingAnalysis>`. Add a defensive note that analysis is purely client-derived (no server action to gate), so the gate is presentational; that is acceptable since it gates a client-only computation, consistent with how it ships today.
- **Import / version-history:** refactor `import-upsell.tsx` and the drawer upsell card to render the shared components (delete the bespoke copy).

### 7. Pricing page redesign (mockup-first)
2–3 HTML mockups under `.superpowers/brainstorm/<id>/content/` in the dark iOS design system: Free vs Premium comparison, monthly/annual segmented toggle with dynamic savings %, lead features prominent, full list below, subtle future-AI line, brand-yellow as sole CTA accent. **Present for sign-off before coding.** Then rebuild `plan-card.tsx` + `page.tsx` on canonical `--canvas-dark-*` tokens (current page uses generic shadcn tokens). Comparison Free column reads `PLAN_LIMITS.free`.

## Stripe audit + dev-sandbox verification (hard requirement)

Verify and fix as needed:
- `/pricing` loads live Stripe prices; monthly/annual toggle + savings % correct; checkout CTA fires.
- `/welcome` renders post-checkout; fires `checkout_completed`.
- `/settings/billing` renders all 5 branches (free / active / trialing / past_due / canceled).
- Webhook flips `subscriptionStatus` for `customer.subscription.{created,updated,deleted}`.

**New-user Free→Premium in the dev sandbox (documented procedure, must actually work):**
1. Create two **test-mode** Stripe Price objects: $7.99/mo recurring and $59.99/yr recurring on one "Beehive Premium" product.
2. Set `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_ANNUAL` (test IDs) + `STRIPE_SECRET_KEY` (sk_test) + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test) in `.env.local`.
3. Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`; copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`.
4. With `DEV_FORCE_PREMIUM` **unset**: sign up as a new user → hit a gate → UpgradeModal → "Upgrade now" → Stripe Checkout → card `4242 4242 4242 4242` → redirect to `/welcome` → webhook flips `subscriptionStatus=active` → premium unlocks (gates clear).

Do NOT reconfigure the production Stripe dashboard webhook or touch live keys. `DEV_FORCE_PREMIUM=true` stays as the shortcut for non-billing local work.

## Testing
- `npx tsc --noEmit` clean.
- `npm test` green; add a small unit test asserting every `GateKey` resolves `FEATURE_COPY` + that `PLAN_LIMITS` free < premium for numeric limits.
- No em-dashes in any user-facing copy. Brand-yellow restraint honored. Design-system tokens only.
- Manual smoke: each of the 7 gates shows the prompt; modal routes to `/pricing`; real test-mode checkout completes and flips a new user to premium end-to-end.

## Out of scope (deferred)
- Mobile app store IAP vs external-link-out (web path only for #38; pricing chosen to survive it).
- A 3rd "Pro" tier (revisit when AI tooling actually ships).
- Real analytics provider wiring (stub now, swap later).
- Homepage pricing-preview section (that is #41; this spec leaves the reusable registry + pricing-data helper it will consume).
- Schema changes (none — single-tier infra already supports everything here).

## Coordination with #41
#41 (homepage redesign, not started) adds a homepage pricing *preview* and also touches `/pricing`. By centralizing copy in `feature-registry.ts` and numbers/fetch in `pricing-data.ts` + `limits.ts`, #41 reuses all of it. This spec does not touch homepage files. If #41 lands first, re-check `/pricing` shared state before editing.
