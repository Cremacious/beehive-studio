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
