'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { trackEvent } from '@/lib/analytics/track-event'
import { FEATURE_COPY, PREMIUM_BENEFITS, type GateKey } from '@/lib/upgrade/feature-registry'
import { PRICING_DISPLAY } from '@/lib/plans/limits'

type Props = {
  feature: GateKey
  locale: string
  // Accepted for call-site stability; the pricing page now owns the
  // authed (checkout) vs unauthed (sign-up) branch, so the modal just
  // routes everyone there to choose a plan.
  isAuthed?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UpgradeModal({ feature, locale, open, onOpenChange }: Props) {
  const copy = FEATURE_COPY[feature]
  const wasOpen = useRef(false)

  // Fire once each time the modal transitions closed -> open, regardless of how
  // it was opened (the prompt button OR a gate opening it directly).
  useEffect(() => {
    if (open && !wasOpen.current) {
      trackEvent('upgrade_modal_opened', { feature })
    }
    wasOpen.current = open
  }, [open, feature])

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
          ${PRICING_DISPLAY.monthlyUsd}/mo or ${PRICING_DISPLAY.annualUsd}/yr. Choose your plan on the next step.
        </p>

        <div className="flex flex-col gap-2 mt-1">
          {/* Routes to /pricing so the user explicitly picks monthly vs annual
              before any Stripe checkout is created. */}
          <Link
            href={`/${locale}/pricing`}
            onClick={() => onOpenChange(false)}
            className="w-full text-center rounded-md py-2.5 font-semibold transition-colors"
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              fontFamily: 'var(--font-display)',
            }}
          >
            Upgrade now
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
