import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildUrl, type TabId } from '@/lib/discover/url-state'

type Props = {
  tab: TabId
  locale: string
  /** 1-indexed current page. */
  page: number
  totalPages: number
  /** Other URL params to preserve on each page link. */
  baseParams: Record<string, string | string[] | undefined>
}

/**
 * Renders ‹ Prev · 1 · 2 · 3 · … · N · Next › for the discover grid.
 * Returns null when totalPages <= 1. Each page link is a server-rendered URL
 * (`?page=N`) so the route navigates with full SSR.
 */
export function NumberedPagination({
  tab,
  locale,
  page,
  totalPages,
  baseParams,
}: Props) {
  if (totalPages <= 1) return null

  const basePath = `/${locale}/discover`
  const hrefFor = (n: number): string => {
    const params: Record<string, string | string[] | undefined> = { ...baseParams }
    if (n === 1) {
      delete params.page
    } else {
      params.page = String(n)
    }
    return buildUrl(tab, params, basePath)
  }

  // Build the visible page list with ellipses.
  // Always show: first, last, and a window of +/- 2 around current.
  const visible = new Set<number>([1, totalPages, page])
  for (let i = 1; i <= 2; i++) {
    if (page - i >= 1) visible.add(page - i)
    if (page + i <= totalPages) visible.add(page + i)
  }
  const sorted = Array.from(visible).sort((a, b) => a - b)
  const cells: Array<number | 'ellipsis'> = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) cells.push('ellipsis')
    cells.push(sorted[i])
  }

  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <nav
      className="flex items-center justify-center gap-1.5 pt-4 flex-wrap"
      aria-label="Pagination"
    >
      {hasPrev ? (
        <Link
          href={hrefFor(page - 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] rounded-[var(--r-row)] border border-transparent text-[var(--canvas-dark-ink)] hover:bg-[oklch(from_var(--brand)_l_c_h_/_0.10)] hover:text-[var(--brand)]"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Prev
        </Link>
      ) : (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] rounded-[var(--r-row)] text-[var(--canvas-dark-ink-muted)] opacity-50 cursor-not-allowed"
          aria-disabled="true"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Prev
        </span>
      )}

      {cells.map((cell, i) => {
        if (cell === 'ellipsis') {
          return (
            <span
              key={`ellipsis-${i}`}
              className="px-2 text-[12px] text-[var(--canvas-dark-ink-muted)]"
              aria-hidden="true"
            >
              …
            </span>
          )
        }
        const isActive = cell === page
        if (isActive) {
          return (
            <span
              key={cell}
              className="inline-flex items-center justify-center min-w-[32px] px-2.5 py-1.5 text-[12px] font-bold rounded-[var(--r-row)]"
              style={{
                background: 'var(--brand)',
                color: 'var(--brand-ink)',
              }}
              aria-current="page"
            >
              {cell}
            </span>
          )
        }
        return (
          <Link
            key={cell}
            href={hrefFor(cell)}
            className="inline-flex items-center justify-center min-w-[32px] px-2.5 py-1.5 text-[12px] rounded-[var(--r-row)] border border-[var(--br-card)] text-[var(--canvas-dark-ink)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
            aria-label={`Go to page ${cell}`}
          >
            {cell}
          </Link>
        )
      })}

      {hasNext ? (
        <Link
          href={hrefFor(page + 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] rounded-[var(--r-row)] border border-transparent text-[var(--canvas-dark-ink)] hover:bg-[oklch(from_var(--brand)_l_c_h_/_0.10)] hover:text-[var(--brand)]"
          aria-label="Next page"
        >
          Next
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      ) : (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] rounded-[var(--r-row)] text-[var(--canvas-dark-ink-muted)] opacity-50 cursor-not-allowed"
          aria-disabled="true"
        >
          Next
          <ChevronRight size={14} aria-hidden="true" />
        </span>
      )}
    </nav>
  )
}
