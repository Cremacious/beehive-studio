'use client'

import { useEffect, useState, type RefObject } from 'react'
import { X } from 'lucide-react'
import { useDismissedTips } from '@/lib/tips/use-dismissed-tips'
import { getTip, type TipKey } from '@/lib/tips/registry'

type Placement = 'right' | 'left' | 'top' | 'bottom'

type Props = {
  tipKey: TipKey
  anchorRef: RefObject<HTMLElement | null>
  placement?: Placement
  // Gate so two popups never stack on one surface (e.g. wait until the page
  // explainer is dismissed before pointing at an affordance). Defaults to true.
  enabled?: boolean
}

const GAP = 12
const CARD_WIDTH = 260

// Anchored contextual tip ("coach mark") that points at a specific affordance.
// Shows once per tip key. Positioned with fixed coordinates derived from the
// anchor's bounding rect, recomputed on resize / scroll / layout shifts so it
// tracks the anchor. Degrades gracefully: if the anchor is not mounted (rect is
// null) it renders nothing rather than floating in the corner.
export function CoachMark({ tipKey, anchorRef, placement = 'right', enabled = true }: Props) {
  const { hydrated, isDismissed, dismiss } = useDismissedTips()
  const tip = getTip(tipKey)

  const visible = hydrated && enabled && !isDismissed(tipKey)

  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!visible) {
      setRect(null)
      return
    }
    const measure = () => {
      const el = anchorRef.current
      setRect(el ? el.getBoundingClientRect() : null)
    }
    measure()
    // Recompute on viewport changes + periodically to catch the anchor mounting
    // or layout settling after hydration.
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    const interval = window.setInterval(measure, 250)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      window.clearInterval(interval)
    }
  }, [visible, anchorRef])

  // Escape to dismiss.
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss(tipKey)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, dismiss, tipKey])

  if (!visible || !rect) return null

  // Position the card relative to the anchor rect, clamped to the viewport.
  let top = rect.top + rect.height / 2
  let left = rect.right + GAP
  let translate = 'translateY(-50%)'

  if (placement === 'left') {
    left = rect.left - GAP - CARD_WIDTH
    top = rect.top + rect.height / 2
    translate = 'translateY(-50%)'
  } else if (placement === 'top') {
    left = rect.left + rect.width / 2
    top = rect.top - GAP
    translate = 'translate(-50%, -100%)'
  } else if (placement === 'bottom') {
    left = rect.left + rect.width / 2
    top = rect.bottom + GAP
    translate = 'translate(-50%, 0)'
  }

  // Keep the card on-screen horizontally for side placements.
  if (placement === 'right' || placement === 'left') {
    const maxLeft = window.innerWidth - CARD_WIDTH - 8
    left = Math.max(8, Math.min(left, maxLeft))
    // Keep vertically inside the viewport (center is mid-anchor; clamp softly).
    top = Math.max(80, Math.min(top, window.innerHeight - 80))
  }

  return (
    <div
      role="dialog"
      aria-label={tip.title}
      className="fixed z-50"
      style={{
        top,
        left,
        transform: translate,
        width: CARD_WIDTH,
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
      }}
    >
      <div className="flex items-start gap-2 px-4 pt-3 pb-2">
        <div className="flex-1 min-w-0">
          <div
            className="font-mono uppercase"
            style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--brand)' }}
          >
            Tip
          </div>
          <h3
            className="m-0 mt-0.5"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '-0.005em',
              color: 'var(--canvas-dark-ink-strong)',
            }}
          >
            {tip.title}
          </h3>
        </div>
        <button
          onClick={() => dismiss(tipKey)}
          aria-label="Dismiss tip"
          className="inline-flex flex-none items-center justify-center rounded-md transition-colors"
          style={{ width: 26, height: 26, color: 'var(--canvas-dark-ink-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(1 0 0 / 0.06)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <X size={13} />
        </button>
      </div>
      <p
        className="px-4"
        style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--canvas-dark-ink-muted)' }}
      >
        {tip.body}
      </p>
      <div className="flex justify-end px-4 pt-2.5 pb-3">
        <button
          onClick={() => dismiss(tipKey)}
          className="rounded-md px-3 py-1.5 text-[12.5px] font-bold transition-colors"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-hover)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand)' }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
