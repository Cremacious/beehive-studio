import type { ReactNode } from 'react'
import Link from 'next/link'

type Props = {
  activeCount: number
  clearHref: string | null
  children: ReactNode
}

/**
 * Discover sidebar — S2 dark iOS "section tiles" treatment.
 *
 * No border, no shadow. Vertical gradient surface. Sticks below the 56px
 * AppNav and stretches to the bottom of the viewport on scroll. Filter
 * sections are themselves rounded tiles (rendered by <FilterSection>),
 * giving the iOS Settings grouped feel.
 */
export function FilterSidebar({ activeCount, clearHref, children }: Props) {
  return (
    <aside
      className="overflow-hidden"
      style={{
        width: 'var(--w-discover-sidebar)',
        background:
          'linear-gradient(180deg, #222426 0%, #1b1c1e 100%)',
        position: 'sticky',
        top: '64px',
        height: 'calc(100vh - 72px)',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '18px',
      }}
      aria-label="Filters"
    >
      <header
        className="flex items-center justify-between px-5 py-4"
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          flexShrink: 0,
        }}
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
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {children}
      </div>
    </aside>
  )
}
