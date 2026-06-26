'use client'

import { useEffect, useState } from 'react'
import { X, Lightbulb } from 'lucide-react'
import { useDismissedTips } from '@/lib/tips/use-dismissed-tips'
import { getTip, type TipKey } from '@/lib/tips/registry'

type Props = {
  tipKey: TipKey
  // Lets a surface gate the explainer on a freshness / zero-content signal so
  // long-time users are not bombarded on first deploy. Defaults to true.
  enabled?: boolean
}

// First-visit page explainer. Renders a non-blocking dismissible card pinned to
// the bottom-right (no backdrop, so the page stays interactive). Shows once per
// tip key, then never again. Escape or "Got it" dismisses; the choice is synced
// across tabs via the storage event in useDismissedTips.
//
// Design-system chrome: panel gradient + brand-restrained accents (a single
// brand "TIP" eyebrow + the brand "Got it" button). Dark iOS tokens throughout.
export function PageExplainer({ tipKey, enabled = true }: Props) {
  const { hydrated, isDismissed, dismiss } = useDismissedTips()
  const tip = getTip(tipKey)

  const visible = hydrated && enabled && !isDismissed(tipKey)

  // Subtle mount fade-in so the card eases in rather than snapping.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!visible) return
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [visible])

  // Escape to dismiss while the card is visible.
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss(tipKey)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, dismiss, tipKey])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label={tip.title}
      className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] max-md:left-4 max-md:right-4 max-md:w-auto max-md:bottom-[calc(64px+env(safe-area-inset-bottom))]"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        border: 'var(--br-card)',
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 180ms ease, transform 180ms ease',
      }}
    >
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        <span
          className="inline-flex flex-none items-center justify-center mt-0.5"
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: 'var(--brand-soft)',
            color: 'var(--brand)',
          }}
        >
          <Lightbulb size={16} />
        </span>
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
              fontSize: 15,
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
          style={{ width: 28, height: 28, color: 'var(--canvas-dark-ink-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(1 0 0 / 0.06)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <X size={14} />
        </button>
      </div>

      <p
        className="px-5"
        style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--canvas-dark-ink-muted)' }}
      >
        {tip.body}
      </p>

      <div className="flex justify-end px-5 pt-3 pb-4">
        <button
          onClick={() => dismiss(tipKey)}
          className="rounded-md px-3.5 py-1.5 text-[13px] font-bold transition-colors"
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
