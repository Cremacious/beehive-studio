import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { SeriesNeighbors } from '@/lib/books/get-series-neighbors'

type MoreByAuthor = {
  id: string
  title: string
  authorUsername: string | null
  authorDisplayName: string | null
}

type Props = {
  neighbors: SeriesNeighbors
  locale: string
  moreByAuthor?: MoreByAuthor | null
}

function SeriesLink({
  href,
  direction,
  name,
  isNext,
}: {
  href: string
  direction: string
  name: string
  isNext: boolean
}) {
  const Arrow = isNext ? ArrowRight : ArrowLeft
  return (
    <Link
      href={href}
      className="flex items-center no-underline"
      style={{
        gap: '14px',
        padding: '14px 18px',
        borderRadius: 'var(--r-row)',
        background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow: 'var(--sh-tile)',
        color: 'inherit',
        transition: 'transform .14s',
        flexDirection: isNext ? 'row-reverse' : 'row',
        textAlign: isNext ? 'right' : 'left',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = ''
      }}
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center"
        style={{
          flexShrink: 0,
          width: '34px',
          height: '34px',
          borderRadius: 'var(--r-pill)',
          background: 'var(--canvas-dark-100)',
          boxShadow: 'var(--sh-inset)',
          color: 'var(--canvas-dark-ink-muted)',
        }}
      >
        <Arrow size={15} strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span
          className="block"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--canvas-dark-ink-muted)',
          }}
        >
          {direction}
        </span>
        <span
          className="block truncate"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '14px',
            color: 'var(--canvas-dark-ink-strong)',
          }}
        >
          {name}
        </span>
      </span>
    </Link>
  )
}

export function SeriesFooter({ neighbors, locale, moreByAuthor = null }: Props) {
  const { previous, next } = neighbors
  const hasSeries = previous || next

  if (!hasSeries && !moreByAuthor) return null

  return (
    <nav
      aria-label={hasSeries ? 'Series navigation' : 'More by author'}
      className="grid rounded-[var(--r-card)]"
      style={{
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        padding: '16px',
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
    >
      {hasSeries ? (
        <>
          <div>
            {previous && (
              <SeriesLink
                href={`/${locale}/books/${previous.id}`}
                direction="Previous in series"
                name={`${previous.seriesNumber !== null ? `Book ${previous.seriesNumber}: ` : ''}${previous.title}`}
                isNext={false}
              />
            )}
          </div>
          <div>
            {next && (
              <SeriesLink
                href={`/${locale}/books/${next.id}`}
                direction="Next in series"
                name={`${next.seriesNumber !== null ? `Book ${next.seriesNumber}: ` : ''}${next.title}`}
                isNext
              />
            )}
          </div>
        </>
      ) : moreByAuthor ? (
        <>
          <div />
          <div>
            <SeriesLink
              href={`/${locale}/books/${moreByAuthor.id}`}
              direction={`More by @${moreByAuthor.authorUsername ?? 'this author'}`}
              name={moreByAuthor.title}
              isNext
            />
          </div>
        </>
      ) : null}
    </nav>
  )
}
