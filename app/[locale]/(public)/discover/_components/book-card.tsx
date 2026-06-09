import Link from 'next/link'
import { Heart, Bookmark } from 'lucide-react'
import { SeriesLine } from '@/components/book/series-line'
import type { DiscoverBook } from '@/lib/actions/discover.actions'

type Props = { book: DiscoverBook; locale: string }

export function BookCard({ book, locale }: Props) {
  const wordCountFormatted =
    book.wordCount >= 1000
      ? `${Math.round(book.wordCount / 1000)}k words`
      : `${book.wordCount} words`

  return (
    <Link href={`/${locale}/books/${book.id}`} className="block group no-underline">
      <div
        className="overflow-hidden transition-transform"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          borderTop: 'var(--br-card)',
          borderRadius: 'var(--r-card)',
          boxShadow: 'var(--sh-card)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = ''
        }}
      >
        <div
          className="aspect-[2/3] relative flex items-end p-2"
          style={{
            background:
              'linear-gradient(135deg, var(--canvas-dark-300), var(--canvas-dark-200))',
          }}
        >
          {book.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.coverUrl}
              alt={book.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : null}
          {book.genre && (
            <span
              className="relative z-10 inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-[var(--r-pill)]"
              style={{
                background: 'rgb(0 0 0 / 0.5)',
                color: 'rgb(255 255 255 / 0.92)',
                backdropFilter: 'blur(4px)',
              }}
            >
              {book.genre}
            </span>
          )}
        </div>

        <div className="p-3">
          <p
            className="text-[13px] font-semibold leading-snug line-clamp-2 mb-1"
            style={{
              color: 'var(--canvas-dark-ink-strong)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {book.title}
          </p>
          <p
            className="text-[11px] mb-1"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            by {book.authorDisplayName ?? book.authorUsername ?? 'Unknown'}
          </p>
          {book.seriesName && (
            <p
              className="mb-2 truncate"
              style={{ color: 'var(--canvas-dark-ink-muted)' }}
            >
              <SeriesLine
                seriesName={book.seriesName}
                seriesNumber={book.seriesNumber}
              />
            </p>
          )}
          <div
            className="flex justify-between items-center text-[11px]"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>{wordCountFormatted}</span>
            <div className="flex gap-3">
              <span className="inline-flex items-center gap-1">
                <Heart size={11} />
                {book.likeCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <Bookmark size={11} />
                {book.bookmarkCount}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
