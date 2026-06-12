import Link from 'next/link'
import { DiscoverClubCard } from '../../../_components/discover-club-card'
import type { ClubCard } from '@/lib/actions/discover-clubs.actions'

type Props = {
  result: { books: ClubCard[]; nextCursor: string | null }
  locale: string
  hasQuery: boolean
  q?: string
  genre?: string
  sort?: 'relevance' | 'recent' | 'most-active' | 'most-members'
}

export function ClubSearchResults({
  result,
  locale,
  hasQuery,
  q,
  genre,
  sort,
}: Props) {
  if (!hasQuery) {
    return (
      <p className="text-[13px] text-[var(--canvas-dark-ink-muted)] italic py-12 text-center">
        Type something to search Clubs.
      </p>
    )
  }

  if (result.books.length === 0) {
    return (
      <p className="text-[13px] text-[var(--canvas-dark-ink-muted)] italic py-12 text-center">
        No Clubs match that search. Try fewer filters.
      </p>
    )
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3">
        {result.books.map((club) => (
          <li key={club.id}>
            <DiscoverClubCard club={club} locale={locale} variant="grid" />
          </li>
        ))}
      </ul>
      {result.nextCursor && (
        <LoadMoreLink
          locale={locale}
          cursor={result.nextCursor}
          q={q}
          genre={genre}
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
  sort,
}: {
  locale: string
  cursor: string
  q?: string
  genre?: string
  sort?: 'relevance' | 'recent' | 'most-active' | 'most-members'
}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (genre) params.set('genre', genre)
  if (sort) params.set('sort', sort)
  params.set('cursor', cursor)

  return (
    <div className="mt-6 flex justify-center">
      <Link
        href={`/${locale}/discover/clubs/search?${params.toString()}`}
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
