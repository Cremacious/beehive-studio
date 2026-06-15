import type { ReactNode } from 'react'
import Link from 'next/link'

type Props = {
  activeCount: number
  clearHref: string | null
  children: ReactNode
}

export function FilterSidebar({ activeCount, clearHref, children }: Props) {
  return (
    <aside
      className="self-start rounded-[var(--r-card)] border border-[var(--br-card)] overflow-hidden"
      style={{
        width: 'var(--w-discover-sidebar)',
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
      }}
      aria-label="Filters"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--br-card)]">
        <h2 className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--brand)]">
          Filters
        </h2>
        {clearHref && activeCount > 0 ? (
          <Link
            href={clearHref}
            className="text-[10px] text-[var(--canvas-dark-ink-muted)] underline hover:text-[var(--brand)]"
          >
            Clear all ({activeCount})
          </Link>
        ) : null}
      </header>
      <div className="px-4 py-3 space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
        {children}
      </div>
    </aside>
  )
}
