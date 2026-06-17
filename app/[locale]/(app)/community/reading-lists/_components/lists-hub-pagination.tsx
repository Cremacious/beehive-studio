import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  currentPage: number
  totalPages: number
  locale: string
  tab: string
  sort: string
}

/**
 * Renders ‹ Prev · 1 · 2 · 3 · … · N · Next › for the /reading-lists hub grid.
 * Returns null when totalPages <= 1. Mirrors SparksHubPagination's circle-dot
 * styling but constructs `/${locale}/community/reading-lists?...` URLs via URLSearchParams.
 *
 * `page=1` strips the param. Tab + sort are preserved across page links.
 */
export function ListsHubPagination({
  currentPage,
  totalPages,
  locale,
  tab,
  sort,
}: Props) {
  if (totalPages <= 1) return null

  const basePath = `/${locale}/community/reading-lists`
  const hrefFor = (n: number): string => {
    const sp = new URLSearchParams()
    if (tab && tab !== '') sp.set('tab', tab)
    if (sort && sort !== '') sp.set('sort', sort)
    if (n !== 1) sp.set('page', String(n))
    const qs = sp.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  // Build the visible page list with ellipses.
  // Always show: first, last, and a window of +/- 2 around current.
  const visible = new Set<number>([1, totalPages, currentPage])
  for (let i = 1; i <= 2; i++) {
    if (currentPage - i >= 1) visible.add(currentPage - i)
    if (currentPage + i <= totalPages) visible.add(currentPage + i)
  }
  const sorted = Array.from(visible).sort((a, b) => a - b)
  const cells: Array<number | 'ellipsis'> = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) cells.push('ellipsis')
    cells.push(sorted[i])
  }

  const hasPrev = currentPage > 1
  const hasNext = currentPage < totalPages

  return (
    <nav
      className="flex items-center justify-center gap-1 pt-6 flex-wrap"
      aria-label="Pagination"
    >
      {hasPrev ? (
        <Link
          href={hrefFor(currentPage - 1)}
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
        const isActive = cell === currentPage
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
          href={hrefFor(currentPage + 1)}
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
