import Link from 'next/link'
import { DiscoverSparkCard } from '../../../_components/discover-spark-card'
import type { SparkCard, SparkStatus } from '@/lib/actions/discover-sparks.actions'

type Props = {
  result: { books: SparkCard[]; nextCursor: string | null }
  locale: string
  hasQuery: boolean
  q?: string
  genre?: string
  status?: SparkStatus | 'all'
  sort?: 'relevance' | 'recent' | 'urgent' | 'most-entered'
}

export function SparkSearchResults({
  result,
  locale,
  hasQuery,
  q,
  genre,
  status,
  sort,
}: Props) {
  if (!hasQuery) {
    return (
      <p className="text-[13px] text-[var(--canvas-dark-ink-muted)] italic py-12 text-center">
        Type something to search Sparks.
      </p>
    )
  }

  if (result.books.length === 0) {
    return (
      <p className="text-[13px] text-[var(--canvas-dark-ink-muted)] italic py-12 text-center">
        No Sparks match that search. Try fewer filters.
      </p>
    )
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3">
        {result.books.map((spark) => (
          <li key={spark.id}>
            <DiscoverSparkCard spark={spark} locale={locale} variant="grid" />
          </li>
        ))}
      </ul>
      {result.nextCursor && (
        <LoadMoreLink
          locale={locale}
          cursor={result.nextCursor}
          q={q}
          genre={genre}
          status={status}
          sort={sort}
        />
      )}
    </div>
  )
}

function LoadMoreLink({
  locale,
  cursor,
  q,
  genre,
  status,
  sort,
}: {
  locale: string
  cursor: string
  q?: string
  genre?: string
  status?: SparkStatus | 'all'
  sort?: 'relevance' | 'recent' | 'urgent' | 'most-entered'
}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (genre) params.set('genre', genre)
  if (status && status !== 'all') params.set('status', status)
  if (sort) params.set('sort', sort)
  params.set('cursor', cursor)

  return (
    <div className="mt-6 flex justify-center">
      <Link
        href={`/${locale}/discover/sparks/search?${params.toString()}`}
        className="h-9 px-5 inline-flex items-center rounded-[var(--r-pill)] text-[12px] font-medium"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
          boxShadow: 'var(--sh-tile)',
          color: 'var(--canvas-dark-ink-strong)',
        }}
      >
        Load more
      </Link>
    </div>
  )
}
