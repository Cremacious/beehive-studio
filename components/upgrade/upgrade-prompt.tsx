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

export function UpgradePrompt({
  feature,
  locale,
  isAuthed,
  showBenefit = true,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const copy = FEATURE_COPY[feature]
  const lastFired = useRef<GateKey | null>(null)

  useEffect(() => {
    if (lastFired.current === feature) return
    lastFired.current = feature
    trackEvent('upgrade_prompt_shown', { feature })
  }, [feature])

  function handleOpen() {
    // upgrade_modal_opened is fired by UpgradeModal itself on open transition.
    setOpen(true)
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 self-start rounded-md px-3 py-1.5 font-semibold transition-colors"
        style={{
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          fontFamily: 'var(--font-display)',
          fontSize: 12.5,
        }}
      >
        <Sparkles size={13} /> Upgrade to Premium
      </button>
      {showBenefit && (
        <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--canvas-dark-ink-muted)' }}>
          {copy.benefit}
        </p>
      )}
      <UpgradeModal
        feature={feature}
        locale={locale}
        isAuthed={isAuthed}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  )
}
