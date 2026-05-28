'use client'

import type { ReactNode } from 'react'

// DP3 Task 3 — Shared "book page" chrome for FM/BM previews.
//
// The book page is ALWAYS cream paper regardless of the editor theme — it
// represents the printed book page (same conceit as Notes index-cards from
// Task 1). But the SURROUNDING pane is theme-aware:
//   - dark editor mode → chrome-walnut backing (canvas-dark)
//   - light editor mode → paper-200 desk
//
// We bridge that via the `--sheet-canvas` CSS-var pattern Chris flagged in
// Task 2 (character-profile.tsx commit e8b7cb2).

type Props = {
  children: ReactNode
  saveStatusBadge?: ReactNode
  /** Optional override for vertical centering (dedication uses lots of top margin) */
  variant?: 'default' | 'compact' | 'tall'
}

export function PageWrapper({ children, saveStatusBadge, variant = 'default' }: Props) {
  const minHeight = variant === 'compact' ? 540 : variant === 'tall' ? 760 : 700
  const padding = variant === 'compact' ? '64px 56px' : '96px 72px'

  return (
    <div
      data-slot="fbm-pane"
      className="flex-1 overflow-y-auto"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, oklch(0.85 0.18 90 / 0.04), transparent 40%), var(--sheet-canvas)',
      }}
    >
      {/* Theme-aware canvas: dark editor = chrome walnut; light = paper-200. */}
      <style>{`
        [data-slot="fbm-pane"] {
          --sheet-canvas: var(--background);
        }
        [data-editor-theme="light"] [data-slot="fbm-pane"] {
          --sheet-canvas: var(--paper-200);
        }
        /* Empty editable fields get a dashed outline so users see them as
           input zones at rest — without it, the cream-paper page looks
           static and the faded placeholder italics don't read as "click me". */
        [data-slot="fbm-pane"] .bp-field:empty {
          outline: 1px dashed oklch(from var(--paper-ink-muted) l c h / 0.5);
          outline-offset: 5px;
          border-radius: 4px;
        }
        [data-slot="fbm-pane"] [contenteditable]:focus {
          outline: 2px solid oklch(from var(--color-brand) l c h / 0.55);
          outline-offset: 4px;
          border-radius: 4px;
        }
        [data-slot="fbm-pane"] [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: var(--paper-ink-muted);
          opacity: 0.75;
          font-style: italic;
          pointer-events: none;
        }
        [data-slot="fbm-pane"] .bp-field:hover {
          background: oklch(0.85 0.18 90 / 0.10);
          box-shadow: 0 0 0 4px oklch(0.85 0.18 90 / 0.10);
          cursor: text;
        }
      `}</style>

      {saveStatusBadge && (
        <div className="absolute right-6 top-3 z-10">{saveStatusBadge}</div>
      )}

      <article
        data-slot="fbm-book-page"
        style={{
          width: 520,
          minHeight,
          maxWidth: 'calc(100% - 32px)',
          margin: '56px auto',
          background: 'var(--paper-100)',
          borderRadius: 6,
          color: 'var(--paper-ink-strong)',
          padding,
          position: 'relative',
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(95,60,20,0.045) 1px, transparent 0)',
          backgroundSize: '22px 22px',
          boxShadow: [
            '0 1px 0 var(--paper-50) inset',
            '0 -1px 0 oklch(0.92 0.020 82) inset',
            '0 1px 2px rgba(0,0,0,0.3)',
            '0 4px 20px -2px rgba(0,0,0,0.45)',
            '0 28px 60px -20px rgba(0,0,0,0.55)',
          ].join(', '),
        }}
      >
        {children}
      </article>
    </div>
  )
}
