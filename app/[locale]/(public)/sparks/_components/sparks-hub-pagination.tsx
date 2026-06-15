import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  locale: string
  /** 1-indexed current page. */
  page: number
  totalPages: number
  /** Other URL params to preserve on each page link (no `page`). */
  baseParams: Record<string, string | string[] | undefined>
}

/**
 * Renders ‹ Prev · 1 · 2 · 3 · … · N · Next › for the /sparks hub grid.
 * Returns null when totalPages <= 1. Mirrors NumberedPagination's circle-dot
 * styling but constructs `/${locale}/sparks?...` URLs via URLSearchParams.
 */
export function SparksHubPagination({ locale, page, totalPages, baseParams }: Props) {
  if (totalPages <= 1) return null

  const basePath = `/${locale}/sparks`
  const hrefFor = (n: number): string => {
    const sp = new URLSearchParams()
    for (const [key, value] of Object.entries(baseParams)) {
      if (key === 'page') continue
      if (value === undefined) continue
      if (Array.isArray(value)) {
        if (value.length === 0) continue
        sp.set(key, value.join(','))
      } else {
        if (value === '') continue
        sp.set(key, value)
      }
    }
    if (n !== 1) sp.set('page', String(n))
    const qs = sp.toString()
    return qs ? `${basePath}?${qs}` : basePath
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
      className="flex items-center justify-center gap-1 pt-6 flex-wrap"
      aria-label="Pagination"
    >
      {hasPrev ? (
        <Link
          href={hrefFor(page - 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Prev
        </Link>
      ) : (
        <span
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] text-[var(--canvas-dark-ink-muted)] opacity-30 cursor-not-allowed"
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
              className="px-1 text-[12px] text-[var(--canvas-dark-ink-muted)]"
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
              className="inline-flex items-center justify-center text-[12px] font-bold"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '999px',
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
            className="inline-flex items-center justify-center text-[12px] text-[var(--canvas-dark-ink)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--brand)] transition-colors"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '999px',
            }}
            aria-label={`Go to page ${cell}`}
          >
            {cell}
          </Link>
        )
      })}

      {hasNext ? (
        <Link
          href={hrefFor(page + 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] text-[var(--canvas-dark-ink)] hover:text-[var(--brand)] transition-colors"
          aria-label="Next page"
        >
          Next
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      ) : (
        <span
          className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] text-[var(--canvas-dark-ink-muted)] opacity-30 cursor-not-allowed"
          aria-disabled="true"
        >
          Next
          <ChevronRight size={14} aria-hidden="true" />
        </span>
      )}
    </nav>
  )
}
