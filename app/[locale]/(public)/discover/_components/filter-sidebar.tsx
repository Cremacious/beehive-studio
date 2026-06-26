'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { SlidersHorizontal, X } from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/use-is-mobile'

type Props = {
  activeCount: number
  clearHref: string | null
  children: ReactNode
}

/**
 * Discover sidebar — S2 dark iOS "section tiles" treatment.
 *
 * Desktop: no border, no shadow, vertical gradient surface, sticks below the
 * 56px AppNav and stretches to the viewport bottom. Filter sections are
 * rounded tiles giving the iOS Settings grouped feel.
 *
 * Mobile (issue #50): collapses to a "Filters" trigger button that opens a
 * left slide-in sheet holding the same sections. Single source so every
 * discover tab inherits the drawer.
 */
export function FilterSidebar({ activeCount, clearHref, children }: Props) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  const header = (
    <header
      className="flex items-center justify-between px-5 py-4"
      style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}
    >
      <h2 className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--brand)]">
        Filters
      </h2>
      {clearHref && activeCount > 0 ? (
        <Link
          href={clearHref}
          className="text-[10px] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)]"
        >
          Clear all ({activeCount})
        </Link>
      ) : null}
    </header>
  )

  if (isMobile) {
    return (
      <div className="w-full">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-[var(--r-row)] text-[13px] font-medium"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            color: 'var(--canvas-dark-ink)',
          }}
        >
          <SlidersHorizontal size={16} style={{ color: 'var(--brand)' }} />
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>

        {open && (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Filters">
            <button
              type="button"
              aria-label="Close filters"
              onClick={() => setOpen(false)}
              className="absolute inset-0 cursor-default"
              style={{ background: 'oklch(0 0 0 / 0.5)' }}
            />
            <aside
              className="absolute left-0 top-0 bottom-0 w-[86vw] max-w-[340px] flex flex-col overflow-hidden pt-safe pb-safe"
              style={{ background: 'linear-gradient(180deg, #222426 0%, #1b1c1e 100%)' }}
            >
              <div className="flex items-center justify-between pr-2">
                <div className="flex-1">{header}</div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0"
                  style={{ color: 'var(--canvas-dark-ink-muted)' }}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">{children}</div>
            </aside>
          </div>
        )}
      </div>
    )
  }

  return (
    <aside
      className="overflow-hidden"
      style={{
        width: 'var(--w-discover-sidebar)',
        background: 'linear-gradient(180deg, #222426 0%, #1b1c1e 100%)',
        position: 'sticky',
        top: '64px',
        height: 'calc(100vh - 72px)',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '18px',
      }}
      aria-label="Filters"
    >
      {header}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">{children}</div>
    </aside>
  )
}
