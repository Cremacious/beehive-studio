'use client'

import Link from 'next/link'
import { BookCardMenu } from './book-card-menu'
import { SeriesLine } from '@/components/book/series-line'
import type { BookSummary } from '@/lib/actions/book.actions'

type Props = {
  book: BookSummary
  locale: string
}

function statusAccent(status: BookSummary['status']): string {
  switch (status) {
    case 'Published': return 'var(--status-final)'
    case 'Revised':   return 'var(--status-revised)'
    case 'Drafting':  return 'var(--status-first-draft)'
  }
}

function formatRelative(d: Date): string {
  const diff = Date.now() - new Date(d).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

/** Pick a paper tone based on book id so cards in the grid aren't all the
 *  same shade. Deterministic per book.id so it doesn't shimmer on re-render. */
function paperTone(id: string): string {
  const h = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 5
  switch (h) {
    case 0: return 'var(--paper-50)'
    case 1: return 'var(--paper-100)'
    case 2: return 'var(--paper-200)'
    case 3: return 'var(--paper-300)'
    default: return 'oklch(0.92 0.018 78)'
  }
}

export function BookCard({ book, locale }: Props) {
  const accent = statusAccent(book.status)
  const tone = paperTone(book.id)

  return (
    <div
      className="group relative flex flex-col overflow-hidden transition-all"
      style={{
        background: 'var(--canvas-dark-100)',
        border: '1px solid var(--canvas-dark-300)',
        borderRadius: 'var(--r-2xl)',
        boxShadow: 'var(--el-1)',
        color: 'inherit',
        ['--accent' as string]: accent,
      } as React.CSSProperties}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = 'var(--el-3)'
        e.currentTarget.style.borderColor = 'oklch(0.40 0.003 256)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = 'var(--el-1)'
        e.currentTarget.style.borderColor = 'var(--canvas-dark-300)'
      }}
    >
      {/* Kebab menu — absolute, sits above the link */}
      <div className="absolute z-10" style={{ top: 12, right: 12 }}>
        <BookCardMenu locale={locale} bookId={book.id} bookTitle={book.title} />
      </div>

      <Link
        href={`/${locale}/studio/${book.id}`}
        className="flex flex-col no-underline color-inherit"
        style={{ color: 'inherit' }}
      >
      {/* Top status stripe */}
      <span aria-hidden="true" style={{ height: '4px', background: accent }} />

      {/* Cover */}
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: '5 / 6',
          background: tone,
          color: 'var(--paper-ink-strong)',
          fontFamily: 'var(--font-display)',
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(95,60,20,0.045) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      >
        {/* If a real cover image exists, paint it over the paper tone. */}
        {book.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.coverUrl}
            alt={book.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Status pill — always visible, top-left */}
        <span
          className="absolute inline-flex items-center gap-1.5 uppercase"
          style={{
            top: '12px',
            left: '12px',
            zIndex: 2,
            padding: '4px 10px 4px 8px',
            borderRadius: 'var(--r-full)',
            background: `oklch(from ${accent} l c h / 0.20)`,
            border: `1px solid oklch(from ${accent} calc(l - 0.10) c h / 0.45)`,
            color: `oklch(from ${accent} calc(l - 0.30) c h)`,
            fontFamily: 'var(--font-display)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            backdropFilter: 'blur(4px)',
          }}
        >
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: accent }} />
          {book.status}
        </span>

        {/* Centered cover composition — title-block universal */}
        {!book.coverUrl && (
          <div
            className="absolute inset-0 flex flex-col"
            style={{ padding: '36px 22px 24px' }}
          >
            {book.genre && (
              <div
                className="uppercase text-center"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '8px',
                  letterSpacing: '0.30em',
                  color: 'var(--paper-ink-muted)',
                }}
              >
                {book.genre}
              </div>
            )}
            <div className="m-auto" style={{ color: 'var(--paper-ink-strong)' }}>
              <svg width="48" height="48" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round">
                <path d="M10 44 L14 22 L24 32 L32 16 L40 32 L50 22 L54 44 Z" fill="currentColor" fillOpacity="0.18" />
                <circle cx="14" cy="20" r="1.4" fill="currentColor" />
                <circle cx="32" cy="14" r="1.4" fill="currentColor" />
                <circle cx="50" cy="20" r="1.4" fill="currentColor" />
                <path d="M10 48 L54 48" />
              </svg>
            </div>
            <div className="text-center" style={{ marginBottom: '4px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '17px',
                  letterSpacing: '-0.01em',
                  color: 'var(--paper-ink-strong)',
                  lineHeight: 1.05,
                  textWrap: 'balance' as const,
                }}
              >
                {book.title}
              </div>
              <div
                className="mx-auto"
                style={{ width: '28px', height: '1px', background: 'var(--paper-ink-strong)', margin: '10px auto', opacity: 0.55 }}
              />
              <div
                className="uppercase text-center"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '8px',
                  letterSpacing: '0.26em',
                  color: 'var(--paper-ink-muted)',
                }}
              >
                Beehive Studio
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info band */}
      <div
        className="flex flex-col gap-1.5"
        style={{
          padding: '16px 18px 18px',
          borderTop: '1px solid var(--canvas-dark-300)',
        }}
      >
        <div
          className="flex items-center gap-2 uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.10em',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          <span style={{ color: 'var(--canvas-dark-ink)' }}>{book.genre || 'No genre yet'}</span>
          <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--canvas-dark-300)' }} />
          <span>{formatRelative(book.lastEditedAt)}</span>
        </div>

        {book.seriesName && (
          <SeriesLine
            seriesName={book.seriesName}
            seriesNumber={book.seriesNumber}
            className="block"
          />
        )}

        <div
          className="truncate transition-colors group-hover:[color:var(--brand)]"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '16px',
            letterSpacing: '-0.01em',
            color: 'var(--canvas-dark-ink-strong)',
            lineHeight: 1.2,
            margin: '2px 0 4px',
          }}
        >
          {book.title}
        </div>

        <div
          className="flex items-center gap-2.5"
          style={{
            fontSize: '12px',
            color: 'var(--canvas-dark-ink-muted)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          <span>
            <b style={{ color: 'var(--canvas-dark-ink)', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
              {book.wordCount.toLocaleString()}
            </b>{' '}
            words
          </span>
          <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--canvas-dark-300)' }} />
          <span>
            <b style={{ color: 'var(--canvas-dark-ink)', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
              {book.chapterCount}
            </b>{' '}
            {book.chapterCount === 1 ? 'chapter' : 'chapters'}
          </span>
        </div>
      </div>
      </Link>
    </div>
  )
}
