'use client'

import Link from 'next/link'
import type { BookCard } from '@/lib/actions/discover.actions'
import { RailCoverArt } from './rail-book-card'

type Props = {
  book: BookCard
  locale: string
}

export function BookGridCard({ book, locale }: Props) {
  return (
    <Link
      href={`/${locale}/books/${book.id}`}
      className="block no-underline w-full"
      aria-label={`Open ${book.title}`}
    >
      <div
        className="overflow-hidden transition-transform"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          borderRadius: 'var(--r-btn)',
          boxShadow: 'var(--sh-tile)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow =
            '0 6px 18px rgb(0 0 0 / 0.35), 0 2px 4px rgb(0 0 0 / 0.25)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = 'var(--sh-tile)'
        }}
      >
        <RailCoverArt coverUrl={book.coverUrl} title={book.title} width={200} />
        <div className="p-3">
          <p
            className="text-[14px] font-semibold leading-snug line-clamp-2"
            style={{
              color: 'var(--canvas-dark-ink-strong)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {book.title}
          </p>
          <p
            className="text-[11px] mt-1 truncate"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            @{book.authorUsername ?? 'unknown'}
          </p>
          {/* TODO(plan): SeriesLine — needs seriesName/seriesNumber added to BookCard projection */}
        </div>
      </div>
    </Link>
  )
}
