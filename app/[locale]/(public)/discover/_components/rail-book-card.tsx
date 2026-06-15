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
  // width currently unused — kept for back-compat with existing call sites.
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
  // Brand-yellow honeycomb fallback — matches /studio book cards.
  // Pattern is inlined per-card so the <pattern id> can be unique across
  // multiple cards on the same page (id collisions cause shared cache repaints).
  const patternId = `hex-${title.replace(/[^a-z0-9]/gi, '').slice(0, 16)}-${title.length}`
  return (
    <div
      className="relative w-full"
      style={{
        aspectRatio: '2 / 3',
        backgroundColor: 'var(--brand)',
      }}
    >
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id={patternId}
            x="0"
            y="0"
            width="60"
            height="52"
            patternUnits="userSpaceOnUse"
          >
            <g
              fill="none"
              stroke="rgba(40, 25, 5, 0.22)"
              strokeWidth="1.4"
              strokeLinejoin="round"
            >
              <polygon points="15,0 27,7 27,19 15,26 3,19 3,7" />
              <polygon points="45,26 57,33 57,45 45,52 33,45 33,33" />
              <polygon points="45,-26 57,-19 57,-7 45,0 33,-7 33,-19" />
              <polygon points="15,52 27,59 27,71 15,78 3,71 3,59" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  )
}

// Export CoverArt for sibling cards in this folder to reuse the fallback shape.
export { CoverArt as RailCoverArt }
export { CoverArt }
