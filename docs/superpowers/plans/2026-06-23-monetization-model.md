# Monetization Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Beehive's monetization model — one editable limits config, a redesigned pricing page, a polished shared upgrade prompt across all 7 premium gates, conversion analytics, and a verified Stripe sandbox flow that takes a brand-new user Free→Premium end-to-end.

**Architecture:** Pure-data foundation first (`lib/plans/limits.ts` single source of truth, `lib/upgrade/feature-registry.ts` copy, `lib/upgrade/pricing-data.ts` Stripe fetch + savings math, `lib/analytics/track-event.ts` stub). Then two shared client components (`<UpgradePrompt>` pill + `<UpgradeModal>` Dialog). Then the pricing-page redesign (mockup-first). Then swap every gate's raw error/disabled state for the shared prompt. Server-side `requirePremium`/`FREE_LIMIT_REACHED` enforcement is never touched — this is presentational + config on top of existing P8A–P8D infra.

**Tech Stack:** Next 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui Dialog, Stripe (already wired), Drizzle/Neon, vitest. Design tokens from `app/globals.css` (`--canvas-dark-*`, `--brand`, `--r-*`). No new dependencies.

**Spec:** [docs/superpowers/specs/2026-06-23-monetization-model-design.md](../specs/2026-06-23-monetization-model-design.md)

**Project copy rule (load-bearing):** No em-dashes (U+2014) in any user-facing string. Brand-yellow restraint per Design System. shadcn Dialog already carries chrome.

---

## Wave 1 — Foundation (pure data, no UI)

### Task 1: Editable plan-limits config + rewire `lib/premium.ts`

**Files:**
- Create: `lib/plans/limits.ts`
- Modify: `lib/premium.ts` (re-derive `FREE_*` constants + `get*LimitForTier` from the config)
- Test: `lib/plans/__tests__/limits.test.ts`

- [ ] **Step 1: Write the config file**

```ts
// lib/plans/limits.ts
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  SINGLE SOURCE OF TRUTH for every Free vs Premium limit.                  │
// │  To change what a tier gets, edit the numbers / booleans below.          │
// │  Nothing else needs to change — the app, the pricing page, and the       │
// │  upgrade prompts all read from here.                                     │
// │  Use Infinity for "unlimited". Booleans gate a whole feature on/off.     │
// └─────────────────────────────────────────────────────────────────────────┘

export const PLAN_LIMITS = {
  free: {
    books: 3, // max active books a free user can have
    hives: 3, // max hives a free user can own
    hiveMembers: 5, // max members allowed in a free user's hive
    versionHistory: false, // chapter snapshots + restore
    publishingMetadata: false, // series, ISBN, publishing notes
    bookImport: false, // import DOCX / PDF / EPUB
    writingAnalysis: false, // editor "Analytics" panel
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

export type PlanTier = keyof typeof PLAN_LIMITS

// Display-only pricing fallback. The AUTHORITATIVE prices come live from Stripe
// (lib/upgrade/pricing-data.ts). These are used only for SSR fallback copy and
// to sanity-check the computed savings percentage.
export const PRICING_DISPLAY = {
  monthlyUsd: 7.99,
  annualUsd: 59.99,
  currency: 'usd',
} as const
```

- [ ] **Step 2: Rewire `lib/premium.ts` to derive from the config**

Replace the hardcoded constants + tier helpers at the top of `lib/premium.ts` (lines 5–24) with derivations. Leave `getUserPremiumStatus` and `requirePremium` untouched.

```ts
import { db } from '@/db'
import { userBilling } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { PLAN_LIMITS } from '@/lib/plans/limits'

export const FREE_BOOK_LIMIT = PLAN_LIMITS.free.books
export const FREE_HIVE_LIMIT = PLAN_LIMITS.free.hives
export const FREE_HIVE_MEMBER_LIMIT = PLAN_LIMITS.free.hiveMembers

/** Returns the max number of active books for the given tier. */
export function getBookLimitForTier(isPremium: boolean): number {
  return (isPremium ? PLAN_LIMITS.premium : PLAN_LIMITS.free).books
}

/** Returns the max number of active hives for the given tier. */
export function getHiveLimitForTier(isPremium: boolean): number {
  return (isPremium ? PLAN_LIMITS.premium : PLAN_LIMITS.free).hives
}

/** Returns the max number of members a hive can have for the given tier. */
export function getHiveMemberLimitForTier(isPremium: boolean): number {
  return (isPremium ? PLAN_LIMITS.premium : PLAN_LIMITS.free).hiveMembers
}
```

(Keep the rest of the file — `PREMIUM_STATUSES`, `getUserPremiumStatus`, `requirePremium` — exactly as is.)

- [ ] **Step 3: Write the test**

```ts
// lib/plans/__tests__/limits.test.ts
import { describe, it, expect } from 'vitest'
import { PLAN_LIMITS, PRICING_DISPLAY } from '@/lib/plans/limits'
import { FREE_BOOK_LIMIT, getBookLimitForTier, getHiveMemberLimitForTier } from '@/lib/premium'

describe('plan limits config', () => {
  it('premium numeric limits are >= free limits', () => {
    expect(PLAN_LIMITS.premium.books).toBeGreaterThanOrEqual(PLAN_LIMITS.free.books)
    expect(PLAN_LIMITS.premium.hiveMembers).toBeGreaterThanOrEqual(PLAN_LIMITS.free.hiveMembers)
  })

  it('lib/premium constants derive from the config', () => {
    expect(FREE_BOOK_LIMIT).toBe(PLAN_LIMITS.free.books)
  })

  it('tier helpers return config values', () => {
    expect(getBookLimitForTier(false)).toBe(PLAN_LIMITS.free.books)
    expect(getBookLimitForTier(true)).toBe(PLAN_LIMITS.premium.books)
    expect(getHiveMemberLimitForTier(true)).toBe(Infinity)
  })

  it('display pricing matches locked decision', () => {
    expect(PRICING_DISPLAY.monthlyUsd).toBe(7.99)
    expect(PRICING_DISPLAY.annualUsd).toBe(59.99)
  })
})
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run lib/plans/__tests__/limits.test.ts` → Expected: PASS.
Run: `npx tsc --noEmit` → Expected: clean (the 33 existing import sites of `FREE_*` constants still resolve).

- [ ] **Step 5: Commit**

```bash
git add lib/plans/limits.ts lib/premium.ts lib/plans/__tests__/limits.test.ts
git commit -m "feat(monetization): single editable plan-limits config (issue #38)"
```

---

### Task 2: `trackEvent` analytics stub

**Files:**
- Create: `lib/analytics/track-event.ts`
- Test: `lib/analytics/__tests__/track-event.test.ts`

- [ ] **Step 1: Write the wrapper**

```ts
// lib/analytics/track-event.ts
'use client'

/**
 * Conversion analytics wrapper. Console-logs in dev, no-ops in prod.
 * Swap the body for PostHog / Vercel Analytics later without touching callers.
 *
 * Known event names (keep this list in sync as callers are added):
 *   'upgrade_prompt_shown'   { feature }
 *   'upgrade_modal_opened'   { feature }
 *   'checkout_started'       { feature?, cycle }
 *   'checkout_completed'     { sessionId? }
 */
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[track]', name, props ?? {})
    return
  }
  // TODO: wire PostHog / Vercel Analytics here. No-op in prod for now.
}
```

- [ ] **Step 2: Write the test**

```ts
// lib/analytics/__tests__/track-event.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { trackEvent } from '@/lib/analytics/track-event'

afterEach(() => vi.restoreAllMocks())

describe('trackEvent', () => {
  it('logs in non-production', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    trackEvent('upgrade_modal_opened', { feature: 'book-limit' })
    expect(spy).toHaveBeenCalledWith('[track]', 'upgrade_modal_opened', { feature: 'book-limit' })
  })

  it('does not throw without props', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    expect(() => trackEvent('checkout_started')).not.toThrow()
  })
})
```

- [ ] **Step 3: Run + commit**

Run: `npx vitest run lib/analytics/__tests__/track-event.test.ts` → Expected: PASS.

```bash
git add lib/analytics/track-event.ts lib/analytics/__tests__/track-event.test.ts
git commit -m "feat(monetization): trackEvent analytics stub (issue #38)"
```

---

### Task 3: Feature/copy registry

**Files:**
- Create: `lib/upgrade/feature-registry.ts`
- Test: `lib/upgrade/__tests__/feature-registry.test.ts`

- [ ] **Step 1: Write the registry**

```ts
// lib/upgrade/feature-registry.ts
import {
  BookOpen,
  History,
  BookMarked,
  Users,
  Lock,
  Upload,
  BarChart3,
  Headphones,
  type LucideIcon,
} from 'lucide-react'

/** One key per in-app premium gate. */
export type GateKey =
  | 'book-limit'
  | 'version-history'
  | 'publishing'
  | 'hive-members'
  | 'overflow'
  | 'import'
  | 'writing-analysis'

type FeatureCopy = {
  /** Headline shown in the modal for this specific gate. */
  title: string
  /** One-line benefit shown on the inline pill / modal subheading. No em-dashes. */
  benefit: string
  icon: LucideIcon
}

export const FEATURE_COPY: Record<GateKey, FeatureCopy> = {
  'book-limit': {
    title: 'Write unlimited books',
    benefit: 'Your free tier holds 3 books. Premium removes the cap.',
    icon: BookOpen,
  },
  'version-history': {
    title: 'Never lose a draft',
    benefit: 'Premium saves chapter snapshots so you can restore any version.',
    icon: History,
  },
  publishing: {
    title: 'Publish like a pro',
    benefit: 'Add series, ISBN, and publishing notes with Premium.',
    icon: BookMarked,
  },
  'hive-members': {
    title: 'Grow your hive',
    benefit: 'Free hives hold 5 members. Premium makes them unlimited.',
    icon: Users,
  },
  overflow: {
    title: 'Unlock all your books',
    benefit: 'Premium keeps every book editable, not just your first 3.',
    icon: Lock,
  },
  import: {
    title: 'Bring your manuscript',
    benefit: 'Import DOCX, PDF, and EPUB into editable chapters with Premium.',
    icon: Upload,
  },
  'writing-analysis': {
    title: 'Sharpen every chapter',
    benefit: 'Premium unlocks readability, pacing, and style analysis.',
    icon: BarChart3,
  },
}

/** Ordered benefit list for the modal + pricing page. Lead 3 first. */
export const PREMIUM_BENEFITS: Array<{ title: string; description: string; icon: LucideIcon }> = [
  { title: 'Unlimited books', description: 'Write as many books as you want.', icon: BookOpen },
  { title: 'Version history', description: 'Snapshot and restore any chapter draft.', icon: History },
  { title: 'Unlimited hive members', description: 'Invite your whole writing circle.', icon: Users },
  { title: 'Publishing metadata', description: 'Series, ISBN, and publishing notes.', icon: BookMarked },
  { title: 'Book import', description: 'Bring in DOCX, PDF, and EPUB manuscripts.', icon: Upload },
  { title: 'Writing analysis', description: 'Readability, pacing, and style insights.', icon: BarChart3 },
  { title: 'Priority support', description: 'Faster help when you need it.', icon: Headphones },
]

/** Subtle forward-looking line for the pricing page. No overpromising. */
export const FUTURE_NOTE = 'AI writing tools are on the way for Premium members.'
```

- [ ] **Step 2: Write the test**

```ts
// lib/upgrade/__tests__/feature-registry.test.ts
import { describe, it, expect } from 'vitest'
import { FEATURE_COPY, PREMIUM_BENEFITS, type GateKey } from '@/lib/upgrade/feature-registry'

const ALL_KEYS: GateKey[] = [
  'book-limit', 'version-history', 'publishing',
  'hive-members', 'overflow', 'import', 'writing-analysis',
]

describe('feature registry', () => {
  it('every gate key resolves copy with no em-dashes', () => {
    for (const key of ALL_KEYS) {
      const c = FEATURE_COPY[key]
      expect(c.title.length).toBeGreaterThan(0)
      expect(c.benefit.length).toBeGreaterThan(0)
      expect(c.title.includes('—')).toBe(false)
      expect(c.benefit.includes('—')).toBe(false)
    }
  })

  it('premium benefits lead with the three headline features', () => {
    expect(PREMIUM_BENEFITS.slice(0, 3).map((b) => b.title)).toEqual([
      'Unlimited books', 'Version history', 'Unlimited hive members',
    ])
  })
})
```

- [ ] **Step 3: Run + commit**

Run: `npx vitest run lib/upgrade/__tests__/feature-registry.test.ts` → Expected: PASS.

```bash
git add lib/upgrade/feature-registry.ts lib/upgrade/__tests__/feature-registry.test.ts
git commit -m "feat(monetization): premium feature/copy registry (issue #38)"
```

---

### Task 4: Pricing-data helper (extract Stripe fetch + savings math)

**Files:**
- Create: `lib/upgrade/pricing-data.ts`
- Test: `lib/upgrade/__tests__/pricing-data.test.ts`

- [ ] **Step 1: Write the helper**

```ts
// lib/upgrade/pricing-data.ts
import 'server-only'
import { stripe } from '@/lib/stripe/client'

export type PriceInfo = { id: string; amount: number; currency: string } // amount in cents

export type PricingData =
  | { ok: true; monthly: PriceInfo; annual: PriceInfo; savingsPct: number }
  | { ok: false; error: string }

/** Pure: percent saved by paying annually vs 12x monthly. 0 when undefined. */
export function computeSavingsPct(monthlyCents: number, annualCents: number): number {
  if (monthlyCents <= 0) return 0
  const annualMonthlyEquivalent = annualCents / 12
  return Math.round((1 - annualMonthlyEquivalent / monthlyCents) * 100)
}

/** Fetches live monthly + annual prices from Stripe and computes savings. */
export async function getPricingData(): Promise<PricingData> {
  try {
    const monthlyId = process.env.STRIPE_PRICE_ID_MONTHLY
    const annualId = process.env.STRIPE_PRICE_ID_ANNUAL
    if (!monthlyId || !annualId) throw new Error('Stripe price IDs are not configured')

    const [m, a] = await Promise.all([
      stripe.prices.retrieve(monthlyId),
      stripe.prices.retrieve(annualId),
    ])
    const monthly: PriceInfo = { id: m.id, amount: m.unit_amount ?? 0, currency: m.currency }
    const annual: PriceInfo = { id: a.id, amount: a.unit_amount ?? 0, currency: a.currency }
    return { ok: true, monthly, annual, savingsPct: computeSavingsPct(monthly.amount, annual.amount) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to load pricing' }
  }
}
```

- [ ] **Step 2: Write the test (pure function only — no Stripe call)**

```ts
// lib/upgrade/__tests__/pricing-data.test.ts
import { describe, it, expect } from 'vitest'
import { computeSavingsPct } from '@/lib/upgrade/pricing-data'

describe('computeSavingsPct', () => {
  it('computes 37% for $7.99/mo vs $59.99/yr', () => {
    expect(computeSavingsPct(799, 5999)).toBe(37)
  })
  it('returns 0 when monthly is 0', () => {
    expect(computeSavingsPct(0, 5999)).toBe(0)
  })
})
```

- [ ] **Step 3: Run + commit**

Run: `npx vitest run lib/upgrade/__tests__/pricing-data.test.ts` → Expected: PASS.

```bash
git add lib/upgrade/pricing-data.ts lib/upgrade/__tests__/pricing-data.test.ts
git commit -m "feat(monetization): pricing-data helper with savings math (issue #38)"
```

---

## Wave 2 — Shared upgrade components

### Task 5: `<UpgradeModal>`

**Files:**
- Create: `components/upgrade/upgrade-modal.tsx`

Uses shadcn `Dialog` (chrome inherited). Controlled via `open` / `onOpenChange` so it works both wrapped by the pill AND opened imperatively from a server-action error. Brand-yellow only on the CTA.

- [ ] **Step 1: Write the component**

```tsx
// components/upgrade/upgrade-modal.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { createCheckoutSessionAction } from '@/lib/actions/billing.actions'
import { trackEvent } from '@/lib/analytics/track-event'
import { FEATURE_COPY, PREMIUM_BENEFITS, type GateKey } from '@/lib/upgrade/feature-registry'
import { PRICING_DISPLAY } from '@/lib/plans/limits'

type Props = {
  feature: GateKey
  locale: string
  isAuthed: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UpgradeModal({ feature, locale, isAuthed, open, onOpenChange }: Props) {
  const copy = FEATURE_COPY[feature]
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpgrade() {
    if (loading) return
    setError(null)
    setLoading(true)
    trackEvent('checkout_started', { feature, cycle: 'monthly' })
    if (!isAuthed) {
      window.location.href = `/${locale}/sign-up?next=${encodeURIComponent(`/${locale}/pricing`)}`
      return
    }
    const result = await createCheckoutSessionAction({ priceKey: 'monthly', locale })
    if (result.success) {
      window.location.href = result.data.url
    } else {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span
            className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-sm uppercase"
            style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em',
              background: 'var(--brand)', color: 'var(--brand-ink)', fontFamily: 'var(--font-mono)',
            }}
          >
            <Sparkles size={9} /> Premium
          </span>
          <DialogTitle style={{ fontFamily: 'var(--font-display)', color: 'var(--canvas-dark-ink-strong)' }}>
            {copy.title}
          </DialogTitle>
          <DialogDescription style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            {copy.benefit}
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2 my-1">
          {PREMIUM_BENEFITS.map((b) => (
            <li key={b.title} className="flex items-start gap-2" style={{ fontSize: 13 }}>
              <Check size={15} style={{ color: 'var(--brand)', marginTop: 2, flexShrink: 0 }} />
              <span style={{ color: 'var(--canvas-dark-ink)' }}>
                <strong style={{ color: 'var(--canvas-dark-ink-strong)' }}>{b.title}</strong>
                {' '}{b.description}
              </span>
            </li>
          ))}
        </ul>

        <p style={{ fontSize: 13, color: 'var(--canvas-dark-ink-muted)' }}>
          ${PRICING_DISPLAY.monthlyUsd}/mo or ${PRICING_DISPLAY.annualUsd}/yr.
        </p>

        <div className="flex flex-col gap-2 mt-1">
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full rounded-md py-2.5 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)', fontFamily: 'var(--font-display)' }}
          >
            {loading ? 'Preparing checkout...' : 'Upgrade now'}
          </button>
          <Link
            href={`/${locale}/pricing`}
            className="w-full text-center rounded-md py-2 text-sm"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
            onClick={() => onOpenChange(false)}
          >
            See all plans
          </Link>
          {error && <p className="text-xs text-center" role="alert" style={{ color: 'var(--destructive)' }}>{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → Expected: clean. (If shadcn `dialog.tsx` does not export `DialogDescription`, read `components/ui/dialog.tsx` and use the exports it actually provides.)

```bash
git add components/upgrade/upgrade-modal.tsx
git commit -m "feat(monetization): shared UpgradeModal component (issue #38)"
```

---

### Task 6: `<UpgradePrompt>` inline pill

**Files:**
- Create: `components/upgrade/upgrade-prompt.tsx`

The declarative pill used at most gates. Owns its own modal state, fires `upgrade_prompt_shown` once on mount and `upgrade_modal_opened` on click.

- [ ] **Step 1: Write the component**

```tsx
// components/upgrade/upgrade-prompt.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/track-event'
import { FEATURE_COPY, type GateKey } from '@/lib/upgrade/feature-registry'
import { UpgradeModal } from './upgrade-modal'
import { cn } from '@/lib/utils'

type Props = {
  feature: GateKey
  locale: string
  isAuthed: boolean
  /** Show the one-line benefit under the pill. Default true. */
  showBenefit?: boolean
  className?: string
}

export function UpgradePrompt({ feature, locale, isAuthed, showBenefit = true, className }: Props) {
  const [open, setOpen] = useState(false)
  const copy = FEATURE_COPY[feature]
  const shown = useRef(false)

  useEffect(() => {
    if (shown.current) return
    shown.current = true
    trackEvent('upgrade_prompt_shown', { feature })
  }, [feature])

  function handleOpen() {
    trackEvent('upgrade_modal_opened', { feature })
    setOpen(true)
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 self-start rounded-md px-3 py-1.5 font-semibold transition-colors"
        style={{ background: 'var(--brand)', color: 'var(--brand-ink)', fontFamily: 'var(--font-display)', fontSize: 12.5 }}
      >
        <Sparkles size={13} /> Upgrade to Premium
      </button>
      {showBenefit && (
        <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--canvas-dark-ink-muted)' }}>{copy.benefit}</p>
      )}
      <UpgradeModal feature={feature} locale={locale} isAuthed={isAuthed} open={open} onOpenChange={setOpen} />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` → Expected: clean.

```bash
git add components/upgrade/upgrade-prompt.tsx
git commit -m "feat(monetization): shared UpgradePrompt pill (issue #38)"
```

---

## Wave 3 — Pricing page (MOCKUP-FIRST)

### Task 7: Pricing-page mockups (HUMAN GATE — present before coding)

**Files:**
- Create: `.superpowers/brainstorm/<timestamp>/content/pricing-mockups.html`

- [ ] **Step 1: Build 2–3 static HTML mockups** in the dark iOS design system: Free vs Premium two-column comparison; monthly/annual segmented toggle showing dynamic savings %; lead features (Unlimited books, Version history, Unlimited hive members) prominent; full benefit list below; subtle `FUTURE_NOTE` line; brand-yellow as the only CTA accent; Free column shows `3 books / 3 hives / 5 members` (from `PLAN_LIMITS.free`).

- [ ] **Step 2: STOP. Present mockups to Chris and get sign-off on one variant before Task 8.** Do not write page code until a variant is chosen.

(No commit — mockups are throwaway design artifacts under `.superpowers/`.)

---

### Task 8: Rebuild pricing page on canonical tokens + shared data

**Files:**
- Modify: `app/[locale]/(public)/pricing/page.tsx`
- Modify: `app/[locale]/(public)/pricing/_components/plan-card.tsx`
- Reference: `app/[locale]/(public)/pricing/_components/feature-list.tsx` (replace hardcoded list with `PREMIUM_BENEFITS`)

- [ ] **Step 1: Switch the page to `getPricingData()`**

Replace the inline Stripe fetch in `page.tsx` with `getPricingData()` from `lib/upgrade/pricing-data.ts`; pass `monthly`, `annual`, `savingsPct` to `<PlanCard>`. Keep the `auth.api.getSession` → `isAuthed` plumbing. Keep `export const revalidate = 3600`.

- [ ] **Step 2: Re-skin `plan-card.tsx` to the chosen mockup** using `--canvas-dark-*` / `--brand` / `--r-card` tokens (replace the generic `bg-card`/`border-border` shadcn tokens). Render the Free-vs-Premium comparison; Free column numbers come from `PLAN_LIMITS.free` (e.g. `{PLAN_LIMITS.free.books} books`). Accept `savingsPct` as a prop instead of recomputing. The CTA path is unchanged (`createCheckoutSessionAction` when authed, sign-up link otherwise). Add `import { FUTURE_NOTE } from '@/lib/upgrade/feature-registry'` for the subtle future line. No em-dashes.

- [ ] **Step 3: Point `feature-list.tsx` at `PREMIUM_BENEFITS`** so the listed features stay in sync with the registry.

- [ ] **Step 4: Verify in the browser**

Use preview tools: start dev server, load `/en/pricing`, confirm prices render, toggle flips monthly/annual with correct savings %, dark-iOS styling matches the mockup, CTA visible. Screenshot for Chris.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → Expected: clean.

```bash
git add app/[locale]/\(public\)/pricing/
git commit -m "feat(monetization): redesign pricing page on canonical tokens (issue #38)"
```

---

## Wave 4 — Gate integrations (all 7)

> For each task: READ the target file first to find the exact current error/disabled/upsell block, then replace it with the shared component. Do NOT change any server action or `requirePremium` call. Thread `locale` + `isAuthed`/`isPremium` from the nearest server component that already has them.

### Task 9: Book-limit gate

**Files:**
- Modify: the create-book surface that surfaces `FREE_LIMIT_REACHED` from `createBookAction` — `app/[locale]/(app)/studio/new/_components/book-creation-form.tsx` and/or `creation-path-landing.tsx`.

- [ ] **Step 1: Read the file(s)** and locate where `FREE_LIMIT_REACHED` is handled (toast/error). 
- [ ] **Step 2:** When the action returns `FREE_LIMIT_REACHED`, render `<UpgradeModal feature="book-limit" ... open .../>` (imperative) instead of a raw error toast. Open it by setting local state on that error. Thread `locale` + `isAuthed` (authed is always true inside studio, pass `isAuthed`).
- [ ] **Step 3:** Verify with preview tools as a free user at the 4th book (set `DEV_FORCE_PREMIUM` unset; temporarily seed 3 books or lower `PLAN_LIMITS.free.books` to 1 to force it, then restore).
- [ ] **Step 4: Commit**

```bash
git add app/[locale]/\(app\)/studio/new/
git commit -m "feat(monetization): book-limit upgrade prompt (issue #38)"
```

### Task 10: Hive limit + member-limit gate

**Files:**
- Modify: the hive-create + hive-invite surfaces that surface `FREE_LIMIT` from `hive.actions.ts` (e.g. `app/[locale]/(app)/studio/_components/create-hive-modal.tsx` and the hive members invite UI under `app/[locale]/(app)/hive/[hiveId]/`).

- [ ] **Step 1: Read** the create-hive modal + members invite component; locate the `FREE_LIMIT` error handling.
- [ ] **Step 2:** Replace raw error with imperative `<UpgradeModal feature="hive-members" ... />` opened on that error. (One feature key covers both hive-count and member-count caps; copy is generic enough.)
- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(app\)/studio/_components/create-hive-modal.tsx app/[locale]/\(app\)/hive/
git commit -m "feat(monetization): hive limit upgrade prompt (issue #38)"
```

### Task 11: Publishing-metadata gate

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/details/_components/book-details-form.tsx` (publishing section) and/or `details/page.tsx` (which already computes premium status).

- [ ] **Step 1: Read** the publishing section; locate the disabled/locked state for non-premium.
- [ ] **Step 2:** Replace the locked-section placeholder with `<UpgradePrompt feature="publishing" locale={locale} isAuthed />`. Keep the section's server-side gate. `details/page.tsx` already fetches premium status (`isPremium`) — thread it + `locale` into the form.
- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(app\)/studio/[bookId]/details/
git commit -m "feat(monetization): publishing metadata upgrade prompt (issue #38)"
```

### Task 12: Version-history drawer → shared prompt

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/version-history-drawer.tsx` (free-tier upsell card).

- [ ] **Step 1: Read** the drawer; locate its bespoke free-tier Premium card.
- [ ] **Step 2:** Replace that card's body with `<UpgradePrompt feature="version-history" locale={locale} isAuthed />`. Thread `locale` + `isAuthed` from the provider/page (the editor already knows premium status via overflow plumbing). Keep the drawer chrome.
- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(app\)/studio/[bookId]/_components/editor/version-history-drawer.tsx
git commit -m "feat(monetization): version-history upgrade prompt (issue #38)"
```

### Task 13: Import upsell → shared prompt

**Files:**
- Modify: `components/import/import-upsell.tsx` (consumers pass `locale`; add `isAuthed`).

- [ ] **Step 1: Read** `import-upsell.tsx` (already a Premium card) + its consumers (`chapter-source-picker.tsx`, `import-wizard-panel.tsx`, `import-modal.tsx`, `creation-path-landing.tsx`).
- [ ] **Step 2:** Re-implement `ImportUpsell` to render the shared `<UpgradePrompt feature="import" locale={locale} isAuthed={isAuthed} />` (keep the outer card chrome if consumers rely on it, but drop the bespoke copy + bespoke Upgrade link). Add `isAuthed` prop; thread from consumers (studio = always authed, pass `true`).
- [ ] **Step 3: Typecheck** (consumers must pass the new prop) → `npx tsc --noEmit`.
- [ ] **Step 4: Commit**

```bash
git add components/import/import-upsell.tsx app/[locale]/\(app\)/studio/
git commit -m "feat(monetization): import upgrade prompt via shared component (issue #38)"
```

### Task 14: Overflow banner restyle

**Files:**
- Modify: the overflow banner component (search `OverflowBanner` / the banner mounted in `chapter-editor.tsx` driven by `bookOverflow`).

- [ ] **Step 1: Read** the overflow banner; it stays a banner (not a pill) but should use registry copy + open the modal.
- [ ] **Step 2:** Keep the banner layout; swap its CTA for a button that opens `<UpgradeModal feature="overflow" ... />` (controlled state) and use `FEATURE_COPY['overflow'].benefit` for the line. Thread `locale` + `isAuthed`.
- [ ] **Step 3: Commit**

```bash
git add app/[locale]/\(app\)/studio/[bookId]/_components/editor/
git commit -m "feat(monetization): overflow banner uses shared upgrade modal (issue #38)"
```

### Task 15: Writing Analysis — NEW gate

**Files:**
- Modify: `app/[locale]/(app)/studio/[bookId]/page.tsx` (already computes `isPremium`/overflow — pass `isPremium` to provider)
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/book-editor-provider.tsx` (expose `isPremium` on context)
- Modify: `app/[locale]/(app)/studio/[bookId]/_components/editor/chapter-editor.tsx` (gate the analysis panel render)

- [ ] **Step 1: Read** `page.tsx`, `book-editor-provider.tsx`, and the `analysisOpen` render block in `chapter-editor.tsx` (around line 424).
- [ ] **Step 2:** Add `isPremium: boolean` to the provider context value (mirror how `bookOverflow` is threaded — `page.tsx` already awaits `getUserPremiumStatus`). 
- [ ] **Step 3:** In `chapter-editor.tsx`, when `analysisOpen` is true: if `isPremium` render `<WritingAnalysis ... />`; else render the upgrade prompt in the same panel slot:

```tsx
{analysisOpen && (
  isPremium ? (
    <WritingAnalysis /* existing props */ />
  ) : (
    <div className="p-4">
      <UpgradePrompt feature="writing-analysis" locale={locale} isAuthed />
    </div>
  )
)}
```

(Import `UpgradePrompt`; get `locale` from `useParams`/provider, `isPremium` from `useBookEditor()`.)

- [ ] **Step 4:** Verify with preview tools: as a free user, clicking Analytics shows the prompt; flip `PLAN_LIMITS` or premium status to confirm premium sees the panel.
- [ ] **Step 5: Commit**

```bash
git add app/[locale]/\(app\)/studio/[bookId]/
git commit -m "feat(monetization): gate Writing Analysis behind Premium (issue #38)"
```

---

## Wave 5 — Analytics wiring, Stripe audit, verification

### Task 16: `checkout_completed` event + Stripe-flow audit

**Files:**
- Modify: `app/[locale]/(app)/welcome/page.tsx` (fire `checkout_completed`)
- Audit (read, fix only if broken): `app/[locale]/(app)/settings/billing/page.tsx` + `_components`, `lib/stripe/handle-subscription-event.ts`, `app/api/webhooks/stripe/route.ts`

- [ ] **Step 1:** On `/welcome`, fire `trackEvent('checkout_completed', { sessionId })` once on mount. `/welcome` is a server component today; add a tiny client child (e.g. `welcome-tracker.tsx`) that calls `trackEvent` in a `useEffect`, reading `session_id` from `searchParams`. (`checkout_started` already fires from the modal Task 5 and should also fire from `plan-card.tsx` — add `trackEvent('checkout_started', { cycle })` in `plan-card.tsx`'s `handleUpgrade`.)
- [ ] **Step 2: Audit** `/settings/billing` renders all 5 branches (free / active / trialing / past_due / canceled) — read the page, confirm each branch exists; fix copy/links if broken (no em-dashes).
- [ ] **Step 3: Audit** webhook handler maps `customer.subscription.{created,updated,deleted}` → `subscriptionStatus`. Read `handle-subscription-event.ts`; confirm. Fix only real gaps.
- [ ] **Step 4: Commit**

```bash
git add app/[locale]/\(app\)/welcome/ app/[locale]/\(public\)/pricing/_components/plan-card.tsx
git commit -m "feat(monetization): checkout analytics events + billing audit (issue #38)"
```

### Task 17: Sandbox verification + suite + AGENTS.md handoff

**Files:**
- Modify: `AGENTS.md` (Resume Here + What Has Been Built + queue), `docs/superpowers/specs/...` cross-link
- Reference: `.env.example` (confirm Stripe vars documented)

- [ ] **Step 1: Full suite + typecheck**

Run: `npx tsc --noEmit` → Expected: clean.
Run: `npm test` → Expected: all green (prior count + new tests from Tasks 1–4).

- [ ] **Step 2: Dev-sandbox end-to-end (the hard requirement).** Document + perform:
  1. Create test-mode Stripe Price objects: $7.99/mo + $59.99/yr on a "Beehive Premium" product (Chris does this in the Stripe test dashboard; capture the price IDs).
  2. Set `.env.local`: `STRIPE_SECRET_KEY=sk_test_...`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`, `STRIPE_PRICE_ID_MONTHLY`/`STRIPE_PRICE_ID_ANNUAL` (test IDs), unset `DEV_FORCE_PREMIUM`.
  3. Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`; copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
  4. Sign up as a new user → hit a gate → UpgradeModal → "Upgrade now" → Stripe Checkout → card `4242 4242 4242 4242`, any future expiry/CVC → redirect to `/welcome` → confirm webhook fired (`stripe listen` log) → `subscriptionStatus=active` in DB → gates clear (premium unlocked).
  5. Confirm `/settings/billing` now shows the active branch + Manage opens the Stripe portal.

- [ ] **Step 3: Manual smoke** each of the 7 gates shows the prompt; modal "See all plans" → `/pricing`; no em-dashes; brand-yellow restraint honored.

- [ ] **Step 4: Update AGENTS.md** per the handoff contract: bump Resume Here (last updated 2026-06-23, mark #38 complete, queue → #37 performance + #44 onboarding), add a "What Has Been Built" entry for the monetization model with the detail level of existing entries (config file location, 7 gates, shared components, pricing redesign, analytics events, sandbox procedure), move #38 to done in the ordered queue.

- [ ] **Step 5: Final commit (doc WITH the work) + close issue — ONLY after Chris approves final changes**

```bash
git add AGENTS.md
git commit -m "docs(agents): issue #38 complete — monetization model shipped"
# After Chris's approval of the whole change set:
# gh issue close 38 --comment "Monetization model shipped: editable limits config, redesigned pricing page, shared UpgradePrompt/UpgradeModal across all 7 gates, trackEvent analytics, verified Stripe sandbox Free->Premium flow."
```

---

## Self-Review

**Spec coverage:** limits config (T1), trackEvent (T2), feature registry (T3), pricing-data (T4), UpgradeModal (T5), UpgradePrompt (T6), pricing mockups + redesign (T7–T8), all 7 gates — book-limit (T9), hive (T10), publishing (T11), version-history (T12), import (T13), overflow (T14), writing-analysis (T15), analytics events + Stripe audit (T16), sandbox verification + handoff (T17). All spec sections mapped.

**Placeholder scan:** Foundation + components (T1–T6) ship complete code. Gate tasks (T9–T15) intentionally instruct "read the file, locate the block, drop in this exact JSX" because the existing error/disabled markup varies per site and must be read at execution time; the *added* content (the `<UpgradePrompt>` / `<UpgradeModal>` usage) is shown explicitly. This is precise, not a placeholder.

**Type consistency:** `GateKey` union (T3) is used identically in T5/T6 and all gate tasks. `PriceInfo`/`PricingData` (T4) consumed by T8. `PLAN_LIMITS` (T1) consumed by T5 modal price line + T8 comparison. `trackEvent` signature (T2) matches all call sites. `createCheckoutSessionAction({ priceKey, locale })` matches the real signature in `billing.actions.ts`.

**Coordination:** #41 not started; pricing page is safe to redesign now; registry + pricing-data left reusable for #41's homepage preview.
