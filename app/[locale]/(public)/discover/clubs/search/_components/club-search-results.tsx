import { DiscoverClubCard } from '../../../_components/discover-club-card'
import type { ClubCard } from '@/lib/actions/discover-clubs.actions'

type Props = {
  result: { books: ClubCard[]; nextCursor: string | null }
  locale: string
  hasQuery: boolean
}

export function ClubSearchResults({ result, locale, hasQuery }: Props) {
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
    </div>
  )
}
