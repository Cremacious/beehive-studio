import { DiscoverSparkCard } from '../../../_components/discover-spark-card'
import type { SparkCard } from '@/lib/actions/discover-sparks.actions'

type Props = {
  result: { books: SparkCard[]; nextCursor: string | null }
  locale: string
  hasQuery: boolean
}

export function SparkSearchResults({ result, locale, hasQuery }: Props) {
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
    </div>
  )
}
