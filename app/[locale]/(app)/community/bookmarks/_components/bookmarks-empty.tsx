import Link from 'next/link'
import { Bookmark, TrendingUp } from 'lucide-react'
import type { TrendingBookCard } from '@/lib/actions/library.actions'
import { GENRE_LABEL } from '@/lib/discover/genres'
import { HoneycombCover } from '@/components/book/honeycomb-cover'

type Props = {
  locale: string
  /** Optional — when present, surface a 4-card "Trending right now" strip
   *  beneath the hero. Empty list hides the strip. */
  trending: TrendingBookCard[]
}

export function BookmarksEmpty({ locale, trending }: Props) {
  return (
    <>
      {/* Hero card */}
      <div
        className="text-center"
        style={{
          background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
          border: '0.5px solid oklch(1 0 0 / 0.04)',
          padding: '80px 24px',
        }}
      >
        <span
          className="inline-flex items-center justify-center mb-6"
          style={{
            width: 78,
            height: 78,
            background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            borderRadius: 18,
          }}
          aria-hidden="true"
        >
          <Bookmark size={36} style={{ color: 'var(--brand)' }} fill="currentColor" />
        </span>
        <h2
          className="text-[22px] font-bold mb-2 m-0"
          style={{
            color: 'var(--canvas-dark-ink-strong)',
            fontFamily: 'var(--font-display)',
          }}
        >
          No bookmarks yet
        </h2>
        <p
          className="mx-auto mb-6 m-0"
          style={{
            color: 'var(--canvas-dark-ink-muted)',
            maxWidth: 380,
            lineHeight: 1.55,
            fontSize: '13.5px',
          }}
        >
          Books you want to come back to will land here. Tap the bookmark icon on any book page to save it.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link
            href={`/${locale}/discover`}
            className="inline-flex items-center gap-1.5 px-[18px] py-2.5 text-[12.5px] font-bold no-underline"
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              borderRadius: 'var(--r-pill)',
              fontFamily: 'var(--font-display)',
            }}
          >
            Discover books →
          </Link>
          <Link
            href={`/${locale}/community/reading-lists`}
            className="inline-flex items-center gap-1.5 px-[18px] py-2.5 text-[12.5px] no-underline"
            style={{
              background: 'var(--canvas-dark-300)',
              color: 'var(--canvas-dark-ink)',
              borderRadius: 'var(--r-row)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
            }}
          >
            Browse reading lists
          </Link>
        </div>
      </div>

      {/* Trending strip */}
      {trending.length > 0 ? (
        <div
          className="mt-12 p-6"
          style={{
            background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
            borderRadius: 'var(--r-card)',
            boxShadow: 'var(--sh-card)',
            border: '0.5px solid oklch(1 0 0 / 0.04)',
          }}
        >
          <h3
            className="flex items-center gap-2.5 text-[13px] m-0 mb-4"
            style={{ color: 'var(--brand)', fontFamily: 'var(--font-display)', fontWeight: 700 }}
          >
            <TrendingUp size={16} aria-hidden="true" />
            Trending right now
          </h3>
          <div
            className="grid gap-[18px]"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
          >
            {trending.map((b) => (
              <TrendingCard key={b.id} book={b} locale={locale} />
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}

function TrendingCard({ book, locale }: { book: TrendingBookCard; locale: string }) {
  const genreLabel = book.genre
    ? ((GENRE_LABEL as Record<string, string>)[book.genre.toLowerCase()] ?? book.genre)
    : null
  return (
    <Link
      href={`/${locale}/books/${book.id}`}
      className="block no-underline group h-full"
      aria-label={`Open ${book.title}`}
    >
      <div
        className="overflow-hidden h-full flex flex-col transition-transform hover:-translate-y-px"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          borderRadius: 14,
          boxShadow: 'var(--sh-tile)',
        }}
      >
        <div className="relative w-full" style={{ aspectRatio: '2 / 3' }}>
          <HoneycombCover src={book.coverUrl} alt={book.title} uid={book.id} />
        </div>
        <div className="p-3 flex-1 flex flex-col gap-1">
          <h4
            className="m-0 text-[13px] font-bold leading-tight"
            style={{
              color: 'var(--canvas-dark-ink-strong)',
              fontFamily: 'var(--font-display)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '2.4em',
            }}
          >
            {book.title}
          </h4>
          <span
            className="text-[10.5px] truncate"
            style={{ color: 'var(--canvas-dark-ink-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {book.authorUsername ? `@${book.authorUsername}` : 'Unknown'}
          </span>
          <div
            className="mt-auto pt-2 flex items-center justify-between text-[9.5px]"
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--canvas-dark-ink-faint)',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <span>{genreLabel ?? '—'}</span>
            <span>♥ {book.likeCount}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
