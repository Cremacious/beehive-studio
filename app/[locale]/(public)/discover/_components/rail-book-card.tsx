'use client'

import Link from 'next/link'
import { Heart, BookOpen } from 'lucide-react'
import type { BookCard } from '@/lib/actions/discover.actions'

type Props = {
  book: BookCard
  locale: string
}

export function RailBookCard({ book, locale }: Props) {
  return (
    <Link
      href={`/${locale}/books/${book.id}`}
      className="block no-underline w-[168px]"
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
        <CoverArt
          coverUrl={book.coverUrl}
          title={book.title}
          width={168}
        />
        <div className="p-2.5">
          <p
            className="text-[13px] font-semibold leading-snug truncate"
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
          </div>
        </div>
      </div>
    </Link>
  )
}

function CoverArt({
  coverUrl,
  title,
  width,
}: {
  coverUrl: string | null
  title: string
  width: number
}) {
  if (coverUrl) {
    return (
      <div
        className="relative w-full"
        style={{ aspectRatio: '2 / 3' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    )
  }
  return (
    <div
      className="relative w-full flex items-center justify-center p-3"
      style={{
        aspectRatio: '2 / 3',
        background:
          'linear-gradient(135deg, oklch(0.88 0.045 75), oklch(0.82 0.06 70))',
      }}
    >
      <span
        className="text-center text-[15px] font-semibold leading-tight line-clamp-4"
        style={{
          fontFamily: 'var(--font-prose)',
          color: 'oklch(0.32 0.05 60)',
        }}
      >
        {title}
      </span>
    </div>
  )
}

// Export CoverArt for sibling cards in this folder to reuse the fallback shape.
export { CoverArt as RailCoverArt }
export { CoverArt }
