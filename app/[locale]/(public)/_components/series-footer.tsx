import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { SeriesNeighbors } from '@/lib/books/get-series-neighbors'

type Props = {
  neighbors: SeriesNeighbors
  locale: string
}

export function SeriesFooter({ neighbors, locale }: Props) {
  const { previous, next } = neighbors
  if (!previous && !next) return null

  return (
    <section
      className="mt-6 grid grid-cols-1 gap-3 rounded-[var(--r-card)] p-5 sm:grid-cols-2"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
    >
      <div>
        {previous && (
          <Link
            href={`/${locale}/books/${previous.id}`}
            className="flex h-full flex-col gap-1 rounded-[var(--r-row)] p-3 hover:bg-[var(--canvas-dark-300)]"
            style={{ boxShadow: 'var(--sh-tile)' }}
          >
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
              <ChevronLeft size={12} /> Previous in series
            </span>
            <span className="text-sm text-[var(--canvas-dark-ink-strong)]">
              {previous.seriesNumber !== null ? `Book ${previous.seriesNumber}: ` : ''}
              {previous.title}
            </span>
          </Link>
        )}
      </div>
      <div className="text-right">
        {next && (
          <Link
            href={`/${locale}/books/${next.id}`}
            className="flex h-full flex-col items-end gap-1 rounded-[var(--r-row)] p-3 hover:bg-[var(--canvas-dark-300)]"
            style={{ boxShadow: 'var(--sh-tile)' }}
          >
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
              Next in series <ChevronRight size={12} />
            </span>
            <span className="text-sm text-[var(--canvas-dark-ink-strong)]">
              {next.seriesNumber !== null ? `Book ${next.seriesNumber}: ` : ''}
              {next.title}
            </span>
          </Link>
        )}
      </div>
    </section>
  )
}
