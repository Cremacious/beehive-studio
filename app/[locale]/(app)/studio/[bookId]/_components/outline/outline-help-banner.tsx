'use client'

/* OutlineHelpBanner — sticky dismissible "how this works" banner.
 * Renders when not dismissed AND beat count < 3. */

import { X } from 'lucide-react'

export function OutlineHelpBanner({
  beatCount,
  dismissed,
  onDismiss,
}: {
  beatCount: number
  dismissed: boolean
  onDismiss: () => void
}) {
  if (dismissed) return null
  if (beatCount >= 3) return null

  return (
    <div
      role="region"
      aria-label="Outline help"
      style={{
        margin: '12px 0',
        padding: '10px 14px',
        borderRadius: 10,
        background: 'var(--outline-act-cap-bg)',
        borderLeft: '3px solid var(--color-brand)',
        boxShadow: 'inset 0 1px 0 oklch(1 0 0 / 0.04)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12.5,
        color: 'var(--outline-ink)',
        lineHeight: 1.4,
      }}
    >
      <span aria-hidden style={{ fontSize: 14 }}>ℹ️</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ color: 'var(--outline-ink-strong)' }}>Outline basics</strong>
        {' — '}
        Beats are scenes. Acts group beats. Drag the{' '}
        <span style={{ fontFamily: 'monospace' }}>⋮⋮</span> handle to reorder
        beats or move them between acts. Click <strong>?</strong> in the
        header for more.
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss help banner"
        title="Dismiss"
        style={{
          width: 28,
          height: 28,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 6,
          background: 'transparent',
          color: 'var(--outline-ink-muted)',
          border: 0,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
