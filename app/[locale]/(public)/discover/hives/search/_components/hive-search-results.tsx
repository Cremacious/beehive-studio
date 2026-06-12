import Link from 'next/link'
import { DiscoverHiveCard } from '../../../_components/discover-hive-card'
import type { HiveCard, SizeBucket } from '@/lib/actions/discover-hives.actions'

type Props = {
  result: { books: HiveCard[]; nextCursor: string | null }
  locale: string
  hasQuery: boolean
  q?: string
  genre?: string
  size?: SizeBucket
  sort?: 'relevance' | 'recent' | 'most-active' | 'most-members'
}

export function HiveSearchResults({
  result,
  locale,
  hasQuery,
  q,
  genre,
  size,
  sort,
}: Props) {
  if (!hasQuery) {
    return (
      <p className="text-[13px] text-[var(--canvas-dark-ink-muted)] italic py-12 text-center">
        Type something to search Hives.
      </p>
    )
  }

  if (result.books.length === 0) {
    return (
      <p className="text-[13px] text-[var(--canvas-dark-ink-muted)] italic py-12 text-center">
        No Hives match that search. Try fewer filters.
      </p>
    )
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3">
        {result.books.map((hive) => (
          <li key={hive.id}>
            <DiscoverHiveCard hive={hive} locale={locale} variant="grid" />
          </li>
        ))}
      </ul>
      {result.nextCursor && (
        <LoadMoreLink
          locale={locale}
          cursor={result.nextCursor}
          q={q}
          genre={genre}
          size={size}
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
  size,
  sort,
}: {
  locale: string
  cursor: string
  q?: string
  genre?: string
  size?: SizeBucket
  sort?: 'relevance' | 'recent' | 'most-active' | 'most-members'
}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (genre) params.set('genre', genre)
  if (size && size !== 'any') params.set('size', size)
  if (sort) params.set('sort', sort)
  params.set('cursor', cursor)

  return (
    <div className="mt-6 flex justify-center">
      <Link
        href={`/${locale}/discover/hives/search?${params.toString()}`}
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
