import { DiscoverListCard } from '../../../_components/discover-list-card'
import type { ListCard } from '@/lib/actions/discover-lists.actions'

type Props = {
  result: { books: ListCard[]; nextCursor: string | null }
  locale: string
  hasQuery: boolean
}

export function ListSearchResults({ result, locale, hasQuery }: Props) {
  if (!hasQuery) {
    return (
      <p className="text-[13px] text-[var(--canvas-dark-ink-muted)] italic py-12 text-center">
        Type something to search Lists.
      </p>
    )
  }

  if (result.books.length === 0) {
    return (
      <p className="text-[13px] text-[var(--canvas-dark-ink-muted)] italic py-12 text-center">
        No Lists match that search. Try fewer filters.
      </p>
    )
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3">
        {result.books.map((list) => (
          <li key={list.id}>
            <DiscoverListCard list={list} locale={locale} variant="grid" />
          </li>
        ))}
      </ul>
    </div>
  )
}
