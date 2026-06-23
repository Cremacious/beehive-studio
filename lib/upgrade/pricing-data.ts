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
