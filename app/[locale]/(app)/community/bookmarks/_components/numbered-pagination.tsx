import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  currentPage: number
  totalPages: number
  /** Base href without `page=` so this component can compose the query. */
  buildHref: (page: number) => string
}

const WINDOW = 1 // pages on each side of current to show inline

export function NumberedPagination({ currentPage, totalPages, buildHref }: Props) {
  if (totalPages <= 1) return null

  const pages = pageWindow(currentPage, totalPages, WINDOW)

  return (
    <nav
      className="flex items-center justify-center gap-1.5 mt-8 flex-wrap"
      aria-label="Bookmarks pagination"
    >
      <Cell
        as={currentPage > 1 ? 'link' : 'disabled'}
        href={buildHref(currentPage - 1)}
        ariaLabel="Previous page"
        wide
      >
        <ChevronLeft size={13} aria-hidden="true" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Prev</span>
      </Cell>

      {pages.map((p, i) =>
        p === '…' ? (
          <span
            key={`gap-${i}`}
            className="px-1 text-[12px]"
            style={{ color: 'var(--canvas-dark-ink-faint)' }}
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <Cell
            key={p}
            as={p === currentPage ? 'current' : 'link'}
            href={buildHref(p)}
            ariaLabel={`Page ${p}`}
          >
            {p}
          </Cell>
        ),
      )}

      <Cell
        as={currentPage < totalPages ? 'link' : 'disabled'}
        href={buildHref(currentPage + 1)}
        ariaLabel="Next page"
        wide
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Next</span>
        <ChevronRight size={13} aria-hidden="true" />
      </Cell>
    </nav>
  )
}

function pageWindow(current: number, total: number, w: number): Array<number | '…'> {
  const set = new Set<number>([1, total, current])
  for (let i = 1; i <= w; i++) {
    set.add(Math.max(1, current - i))
    set.add(Math.min(total, current + i))
  }
  const sorted = Array.from(set).sort((a, b) => a - b)
  const out: Array<number | '…'> = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…')
    out.push(sorted[i])
  }
  return out
}

type CellProps = {
  as: 'link' | 'current' | 'disabled'
  href: string
  ariaLabel: string
  wide?: boolean
  children: React.ReactNode
}

function Cell({ as, href, ariaLabel, wide, children }: CellProps) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    minWidth: wide ? 'auto' : '38px',
    height: '38px',
    padding: wide ? '0 14px' : 0,
    borderRadius: '999px',
    fontSize: '13px',
    textDecoration: 'none',
    boxShadow: 'var(--sh-tile)',
  } as const

  if (as === 'current') {
    return (
      <span
        aria-current="page"
        aria-label={ariaLabel}
        style={{
          ...base,
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          fontWeight: 700,
        }}
      >
        {children}
      </span>
    )
  }
  if (as === 'disabled') {
    return (
      <span
        aria-disabled="true"
        aria-label={ariaLabel}
        style={{
          ...base,
          background: 'linear-gradient(180deg, var(--canvas-dark-300), var(--canvas-dark-250))',
          color: 'var(--canvas-dark-ink-faint)',
          opacity: 0.55,
          cursor: 'not-allowed',
        }}
      >
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      style={{
        ...base,
        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        color: 'var(--canvas-dark-ink)',
      }}
    >
      {children}
    </Link>
  )
}
