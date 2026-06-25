'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Users, type LucideIcon } from 'lucide-react'
import { createCheckoutSessionAction } from '@/lib/actions/billing.actions'
import { trackEvent } from '@/lib/analytics/track-event'
import { cn } from '@/lib/utils'
import { PREMIUM_BENEFITS, FUTURE_NOTE } from '@/lib/upgrade/feature-registry'
import { PLAN_LIMITS } from '@/lib/plans/limits'

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
  savingsPct: number
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/** One comparison row: feature name, what Free gets, what Premium gets. */
type ComparisonRow = {
  title: string
  icon: LucideIcon
  free: string // empty string => "Not included"
  premium: string
}

/**
 * Build the comparison rows from the shared registry + the free-tier limits
 * config so the table stays in sync with PLAN_LIMITS / PREMIUM_BENEFITS.
 */
function buildRows(): ComparisonRow[] {
  const { books, hives, hiveMembers } = PLAN_LIMITS.free
  const freeByTitle: Record<string, string> = {
    'Unlimited books': `Up to ${books}`,
    'Version history': '',
    'Unlimited hive members': `Up to ${hiveMembers}`,
    'Publishing metadata': '',
    'Book import': '',
    'Writing analysis': '',
    'Priority support': '',
  }
  const premiumByTitle: Record<string, string> = {
    'Unlimited books': 'Unlimited',
    'Version history': 'Snapshot + restore',
    'Unlimited hive members': 'Unlimited',
    'Publishing metadata': 'Series, ISBN, notes',
    'Book import': 'DOCX, PDF, EPUB',
    'Writing analysis': 'Readability + pacing',
    'Priority support': 'Faster responses',
  }

  const rows: ComparisonRow[] = PREMIUM_BENEFITS.map((b) => ({
    title: b.title,
    icon: b.icon,
    free: freeByTitle[b.title] ?? '',
    premium: premiumByTitle[b.title] ?? b.description,
  }))

  // Hives row is not in PREMIUM_BENEFITS but worth showing in the table.
  rows.splice(1, 0, {
    title: 'Hives',
    icon: Users,
    free: `Up to ${hives}`,
    premium: 'Unlimited',
  })

  return rows
}

const HAIRLINE = 'oklch(1 0 0 / 0.06)'
const PREMIUM_BG = 'oklch(0.85 0.18 90 / 0.04)'
const PREMIUM_BORDER = 'oklch(0.85 0.18 90 / 0.12)'

export function PlanCard({ locale, isAuthed, monthly, annual, savingsPct }: Props) {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isMonthly = cycle === 'monthly'
  const annualMonthlyEquivalent = annual.amount / 12
  const displayPriceCents = isMonthly ? monthly.amount : annualMonthlyEquivalent

  const rows = buildRows()

  async function handleUpgrade() {
    if (loading) return
    setError(null)
    setLoading(true)
    trackEvent('checkout_started', { cycle })
    try {
      const result = await createCheckoutSessionAction({ priceKey: cycle, locale })
      if (result.success) {
        window.location.href = result.data.url
        return // keep the button in its loading state while the browser navigates away
      }
      setError(result.error)
    } catch (err) {
      // A thrown server action (auth, Stripe, or DB error) would otherwise leave
      // the button stuck on "Preparing checkout..." with no feedback.
      setError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.')
    }
    setLoading(false)
  }

  const signUpHref = `/${locale}/sign-up?next=${encodeURIComponent(`/${locale}/pricing`)}`

  return (
    <div className="w-full max-w-[720px] flex flex-col gap-8" data-slot="plan-card">
      {/* Billing cycle toggle */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Billing cycle"
          className="inline-flex items-center gap-0.5 p-1"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            borderRadius: 'var(--r-pill)',
            boxShadow: 'var(--sh-tile)',
          }}
        >
          <button
            role="tab"
            aria-selected={isMonthly}
            onClick={() => setCycle('monthly')}
            className="text-[13px] font-semibold transition-colors"
            style={{
              fontFamily: 'var(--font-display)',
              padding: '8px 20px',
              borderRadius: 'var(--r-pill)',
              background: isMonthly ? 'var(--brand)' : 'transparent',
              color: isMonthly ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-muted)',
            }}
          >
            Monthly
          </button>
          <button
            role="tab"
            aria-selected={!isMonthly}
            onClick={() => setCycle('annual')}
            className="inline-flex items-center gap-2 text-[13px] font-semibold transition-colors"
            style={{
              fontFamily: 'var(--font-display)',
              padding: '8px 20px',
              borderRadius: 'var(--r-pill)',
              background: !isMonthly ? 'var(--brand)' : 'transparent',
              color: !isMonthly ? 'var(--brand-ink)' : 'var(--canvas-dark-ink-muted)',
            }}
          >
            Annual
            {savingsPct > 0 && (
              <span
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  padding: '2px 7px',
                  borderRadius: 'var(--r-pill)',
                  background: isMonthly ? 'oklch(0.20 0.05 75 / 0.9)' : 'oklch(0 0 0 / 0.25)',
                  color: isMonthly ? 'var(--brand)' : 'oklch(0.20 0.05 75)',
                }}
              >
                Save {savingsPct}%
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Comparison card */}
      <div
        className="overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          border: 'var(--br-card)',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
        }}
      >
        {/* Column headers */}
        <div
          className="grid"
          style={{ gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `1px solid ${HAIRLINE}` }}
        >
          <div
            className="uppercase"
            style={{
              padding: '20px 24px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            Feature
          </div>
          <div style={{ padding: '20px 24px', borderRight: `1px solid ${HAIRLINE}` }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--canvas-dark-ink-strong)',
              }}
            >
              Free
            </div>
            <div style={{ fontSize: 11, marginTop: 2, color: 'var(--canvas-dark-ink-muted)' }}>
              Always free
            </div>
          </div>
          <div
            style={{
              padding: '20px 24px',
              background: 'oklch(0.85 0.18 90 / 0.05)',
              borderLeft: '1px solid oklch(0.85 0.18 90 / 0.15)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--brand)',
              }}
            >
              Premium
            </div>
            <div style={{ fontSize: 11, marginTop: 2, color: 'var(--canvas-dark-ink-muted)' }}>
              Everything, unlocked
            </div>
          </div>
        </div>

        {/* Price row */}
        <div
          className="grid"
          style={{ gridTemplateColumns: '1fr 1fr 1fr', borderBottom: `1px solid ${HAIRLINE}` }}
        >
          <div
            className="flex items-center"
            style={{ padding: '24px', fontSize: 13, color: 'var(--canvas-dark-ink-muted)' }}
          >
            Your investment
          </div>
          <div style={{ padding: '24px', borderRight: `1px solid ${HAIRLINE}` }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 32,
                fontWeight: 700,
                color: 'var(--canvas-dark-ink-strong)',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {formatPrice(0, monthly.currency)}
            </div>
            <div style={{ fontSize: 11, marginTop: 4, color: 'var(--canvas-dark-ink-muted)' }}>
              Forever
            </div>
          </div>
          <div style={{ padding: '24px', background: PREMIUM_BG, borderLeft: `1px solid ${PREMIUM_BORDER}` }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 32,
                fontWeight: 700,
                color: 'var(--brand)',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {formatPrice(displayPriceCents, monthly.currency)}
            </div>
            <div style={{ fontSize: 11, marginTop: 4, color: 'var(--canvas-dark-ink-muted)' }}>
              {isMonthly
                ? 'per month'
                : `per month, billed ${formatPrice(annual.amount, monthly.currency)}/yr`}
            </div>
          </div>
        </div>

        {/* Feature comparison rows */}
        <div className="flex flex-col">
          {rows.map((row, i) => {
            const Icon = row.icon
            return (
              <div
                key={row.title}
                className="grid"
                style={{
                  gridTemplateColumns: '1fr 1fr 1fr',
                  borderBottom: i === rows.length - 1 ? 'none' : `1px solid oklch(1 0 0 / 0.05)`,
                  background: i % 2 === 1 ? 'oklch(1 0 0 / 0.015)' : 'transparent',
                }}
              >
                <div
                  className="flex items-center gap-2.5"
                  style={{ padding: '14px 24px', fontSize: 14, color: 'var(--canvas-dark-ink)' }}
                >
                  <Icon size={14} style={{ color: 'var(--canvas-dark-ink-muted)', flexShrink: 0 }} />
                  {row.title}
                </div>
                <div
                  className="flex items-center"
                  style={{
                    padding: '14px 24px',
                    borderRight: `1px solid ${HAIRLINE}`,
                    fontSize: 13,
                    color: 'var(--canvas-dark-ink-muted)',
                  }}
                >
                  {row.free ? (
                    row.free
                  ) : (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        opacity: 0.45,
                      }}
                    >
                      Not included
                    </span>
                  )}
                </div>
                <div
                  className="flex items-center gap-1.5"
                  style={{
                    padding: '14px 24px',
                    background: 'oklch(0.85 0.18 90 / 0.03)',
                    borderLeft: '1px solid oklch(0.85 0.18 90 / 0.10)',
                    fontSize: 13,
                    color: 'var(--canvas-dark-ink)',
                  }}
                >
                  <Check size={14} strokeWidth={2.5} style={{ color: 'var(--brand)', flexShrink: 0 }} />
                  {row.premium}
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA row */}
        <div
          className="grid"
          style={{ gridTemplateColumns: '1fr 1fr 1fr', borderTop: `1px solid oklch(1 0 0 / 0.08)` }}
        >
          <div
            className="flex items-center"
            style={{
              padding: '24px',
              fontSize: 12,
              fontStyle: 'italic',
              fontFamily: 'var(--font-prose)',
              color: 'var(--canvas-dark-ink-muted)',
            }}
          >
            {FUTURE_NOTE}
          </div>
          <div
            className="flex items-center"
            style={{ padding: '24px', borderRight: `1px solid ${HAIRLINE}` }}
          >
            <span
              className="w-full text-center font-semibold"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                padding: '11px 16px',
                borderRadius: 'var(--r-row)',
                border: '1px solid oklch(1 0 0 / 0.10)',
                color: 'var(--canvas-dark-ink-muted)',
              }}
            >
              Get started
            </span>
          </div>
          <div
            className="flex flex-col items-stretch gap-2"
            style={{ padding: '24px', background: PREMIUM_BG, borderLeft: `1px solid ${PREMIUM_BORDER}` }}
          >
            {isAuthed ? (
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className={cn(
                  'w-full text-center font-bold transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  padding: '11px 16px',
                  borderRadius: 'var(--r-row)',
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                }}
              >
                {loading ? 'Preparing checkout...' : 'Upgrade to Premium'}
              </button>
            ) : (
              <Link
                href={signUpHref}
                className="w-full text-center font-bold transition-colors"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  padding: '11px 16px',
                  borderRadius: 'var(--r-row)',
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                }}
              >
                Upgrade to Premium
              </Link>
            )}
            {error && (
              <p className="text-xs text-center" role="alert" style={{ color: 'var(--destructive)' }}>
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
