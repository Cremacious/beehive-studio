'use client'

import Link from 'next/link'
import { Heart, BookOpen, Circle } from 'lucide-react'
import type { BookCard } from '@/lib/actions/discover.actions'
import { CoverArt } from './rail-book-card'

type Variant = 'rail' | 'grid' | 'row'

type Props = {
  book: BookCard
  locale: string
  variant?: Variant
}

export function DiscoverBookCard({ book, locale, variant = 'rail' }: Props) {
  const widthClass =
    variant === 'rail' ? 'w-[280px]' : variant === 'grid' ? 'w-full' : 'w-full'

  return (
    <Link
      href={`/${locale}/books/${book.id}`}
      className={`block no-underline ${widthClass}`}
      aria-label={`Open ${book.title}`}
    >
      <div
        className="overflow-hidden transition-transform p-3"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          borderRadius: 'var(--r-row)',
          boxShadow: 'var(--sh-tile)',
          display: 'grid',
          gridTemplateColumns: '88px 1fr',
          gap: '12px',
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
        <div
          className="overflow-hidden"
          style={{ borderRadius: 'var(--r-btn)' }}
        >
          <CoverArt coverUrl={book.coverUrl} title={book.title} width={88} />
        </div>

        <div className="flex flex-col min-w-0">
          <p
            className="text-[14px] font-semibold leading-snug truncate"
            style={{
              color: 'var(--canvas-dark-ink-strong)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {book.title}
          </p>
          <p
            className="text-[11px] mt-0.5 truncate"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            @{book.authorUsername ?? 'unknown'}
          </p>

          {book.synopsis ? (
            <p
              className="text-[12.5px] mt-1.5 line-clamp-2"
              style={{
                color: 'var(--canvas-dark-ink)',
                fontFamily: 'var(--font-prose)',
                lineHeight: 1.45,
              }}
            >
              {book.synopsis}
            </p>
          ) : null}

          {book.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-2">
              {book.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-[var(--r-pill)] font-medium"
                  style={{
                    background: 'oklch(from var(--brand) l c h / 0.12)',
                    color: 'var(--brand)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.03em',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div
            className="flex items-center gap-3 mt-2 text-[11px]"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span className="inline-flex items-center gap-1">
              <Heart size={11} aria-hidden />
              {book.likeCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <BookOpen size={11} aria-hidden />
              {book.chapterCount}
            </span>
            {book.isRecentlyActive ? (
              <span className="inline-flex items-center gap-1 text-green-400">
                <Circle size={8} className="fill-current" aria-hidden />
                Updating
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  )
}
