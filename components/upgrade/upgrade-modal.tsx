'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  const wasOpen = useRef(false)

  // Fire once each time the modal transitions closed -> open, regardless of how
  // it was opened (the prompt button OR a gate opening it directly).
  useEffect(() => {
    if (open && !wasOpen.current) {
      trackEvent('upgrade_modal_opened', { feature })
    }
    wasOpen.current = open
  }, [open, feature])

  async function handleUpgrade() {
    if (loading) return
    setError(null)
    setLoading(true)
    trackEvent('checkout_started', { feature, cycle: 'monthly' })
    if (!isAuthed) {
      setLoading(false)
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
              fontSize: '9.5px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <Sparkles size={9} /> Premium
          </span>
          {/* DialogTitle already applies color: var(--brand) via dialog.tsx inline style */}
          <DialogTitle>
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
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              fontFamily: 'var(--font-display)',
            }}
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
          {error && (
            <p
              className="text-xs text-center"
              role="alert"
              style={{ color: 'var(--destructive)' }}
            >
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
