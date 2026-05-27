'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createCheckoutSessionAction } from '@/lib/actions/billing.actions'
import { cn } from '@/lib/utils'
import { FeatureList } from './feature-list'

type PriceInfo = {
  id: string
  amount: number // cents
  currency: string // 'usd' etc
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
  const savings =
    monthly.amount > 0
      ? Math.round((1 - annualMonthlyEquivalent / monthly.amount) * 100)
      : 0
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
          className={cn(
            'text-xs font-semibold px-4 py-1.5 rounded-full transition-colors',
            isCurrentMonthly
              ? 'bg-brand text-brand-ink'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Monthly
        </button>
        <button
          role="tab"
          aria-selected={!isCurrentMonthly}
          onClick={() => setCycle('annual')}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-full transition-colors',
            !isCurrentMonthly
              ? 'bg-brand text-brand-ink'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Annual
          {savings > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: isCurrentMonthly
                  ? 'oklch(from var(--color-brand) l c h / 0.15)'
                  : 'var(--chrome-950)',
                color: 'var(--color-brand)',
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
      <p className="text-xs text-muted-foreground text-center border-t border-border pt-4 leading-relaxed">
        Already on Beehive&apos;s free tier: 3 books, 3 hives, community access.
        Premium unlocks everything above.
      </p>
    </div>
  )
}
