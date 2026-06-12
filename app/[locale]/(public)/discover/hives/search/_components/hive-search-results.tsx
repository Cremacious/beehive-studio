import { DiscoverHiveCard } from '../../../_components/discover-hive-card'
import type { HiveCard } from '@/lib/actions/discover-hives.actions'

type Props = {
  result: { books: HiveCard[]; nextCursor: string | null }
  locale: string
  hasQuery: boolean
}

export function HiveSearchResults({ result, locale, hasQuery }: Props) {
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
    </div>
  )
}
