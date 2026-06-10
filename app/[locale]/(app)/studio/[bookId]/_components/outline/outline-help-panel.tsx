'use client'

/* OutlineHelpPanel — centered modal opened by the ? button in the header
 * strip. Single page of help content. Esc / outside-click dismiss. */

import { useEffect, useRef } from 'react'

export function OutlineHelpPanel({
  open,
  onClose,
  onShowBannerAgain,
}: {
  open: boolean
  onClose: () => void
  onShowBannerAgain: () => void
}) {
  const dismissBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    dismissBtnRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="outline-help-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'oklch(0 0 0 / 0.4)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 520,
          width: '100%',
          background: 'var(--outline-drawer-bg)',
          color: 'var(--outline-ink)',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: 'var(--br-card)',
          padding: '22px 24px',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <h2
          id="outline-help-title"
          style={{
            margin: '0 0 4px',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--outline-ink-strong)',
          }}
        >
          What&apos;s an outline?
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--outline-ink-muted)' }}>
          A workspace for sketching the shape of your story before you write it.
        </p>

        <Section title="Concepts">
          <ul style={ulStyle}>
            <li><strong>Beat:</strong> a single scene or moment (&quot;Hero meets mentor&quot;)</li>
            <li><strong>Act:</strong> a group of beats (Setup, Confrontation, Resolution)</li>
            <li><strong>Linked chapter:</strong> jump from a beat to the chapter you&apos;re drafting it in</li>
          </ul>
        </Section>

        <Section title="Drag and drop">
          <ul style={ulStyle}>
            <li>Drag a beat&apos;s <code>⋮⋮</code> to reorder within an act</li>
            <li>Drag a beat into another act&apos;s header (or its drop zone) to move it</li>
            <li>Drag an act&apos;s <code>⋮⋮</code> to reorder whole acts</li>
          </ul>
        </Section>

        <Section title="Status">
          <p style={{ margin: 0, fontSize: 13 }}>
            Click a beat&apos;s colored dot to cycle: <em>idea → drafting → done</em>
          </p>
        </Section>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button
            type="button"
            onClick={() => {
              onShowBannerAgain()
              onClose()
            }}
            style={{
              minHeight: 36,
              padding: '8px 14px',
              borderRadius: 8,
              background: 'transparent',
              color: 'var(--outline-ink-muted)',
              border: '1px solid var(--outline-rule)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Show banner again
          </button>
          <button
            ref={dismissBtnRef}
            type="button"
            onClick={onClose}
            style={{
              minHeight: 36,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'var(--color-brand)',
              color: 'oklch(0.18 0.02 60)',
              border: 0,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

const ulStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  fontSize: 13,
  lineHeight: 1.6,
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 14 }}>
      <h3
        style={{
          margin: '0 0 6px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--outline-ink-muted)',
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  )
}
