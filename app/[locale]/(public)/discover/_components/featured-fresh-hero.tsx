'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { BookCard } from '@/lib/actions/discover.actions'
import { CoverArt } from './rail-book-card'

type Props = {
  book: BookCard
  locale: string
}

export function FeaturedFreshHero({ book, locale }: Props) {
  return (
    <section
      className="p-6"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200)), radial-gradient(circle at top left, var(--brand-soft), transparent 60%)',
        backgroundBlendMode: 'normal, screen',
        borderRadius: 'var(--r-card)',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
        display: 'grid',
        gridTemplateColumns: '160px 1fr auto',
        gap: '24px',
        alignItems: 'center',
      }}
    >
      <div
        className="relative w-[120px] overflow-hidden"
        style={{ borderRadius: 'var(--r-btn)' }}
      >
        <CoverArt coverUrl={book.coverUrl} title={book.title} width={120} />
        <span
          className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-[var(--r-pill)]"
          style={{
            background: 'var(--brand)',
            color: 'var(--brand-ink)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.08em',
          }}
        >
          New this week
        </span>
      </div>

      <div className="min-w-0 flex flex-col gap-2">
        <h2
          className="text-[28px] font-bold leading-tight"
          style={{
            color: 'var(--brand)',
            fontFamily: 'var(--font-comfortaa)',
          }}
        >
          {book.title}
        </h2>
        <p
          className="text-[12px]"
          style={{
            color: 'var(--canvas-dark-ink-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          @{book.authorUsername ?? 'unknown'}
        </p>
        {book.synopsis ? (
          <p
            className="text-[14px] line-clamp-3"
            style={{
              color: 'var(--canvas-dark-ink)',
              fontFamily: 'var(--font-prose)',
              lineHeight: 1.55,
            }}
          >
            {book.synopsis}
          </p>
        ) : null}
      </div>

      <Link
        href={`/${locale}/books/${book.id}`}
        className="inline-flex items-center gap-2 h-9 px-5 text-[13px] font-semibold whitespace-nowrap transition-colors"
        style={{
          background: 'var(--brand)',
          color: 'var(--brand-ink)',
          borderRadius: 'var(--r-pill)',
          fontFamily: 'var(--font-display)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--brand-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--brand)'
        }}
      >
        Start reading
        <ArrowRight size={14} aria-hidden />
      </Link>
    </section>
  )
}
