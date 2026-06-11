import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  searchSparksDiscoverAction,
  type SparkCard,
  type SparkStatus,
} from '@/lib/actions/discover-sparks.actions'
import { isValidGenre, type GenreSlug } from '@/lib/discover/genres'
import { SparkSearchFilterRail } from './_components/spark-search-filter-rail'
import { SparkSearchResults } from './_components/spark-search-results'

type StatusFilter = SparkStatus | 'all'
type SortKey = 'relevance' | 'recent' | 'urgent' | 'most-entered'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    q?: string
    genre?: string
    status?: string
    sort?: string
    cursor?: string
  }>
}

const STATUS_VALUES: StatusFilter[] = ['all', 'OPEN', 'VOTING', 'CLOSED']
const SORT_VALUES: SortKey[] = ['relevance', 'recent', 'urgent', 'most-entered']

export default async function SparkSearchPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const genre: GenreSlug | undefined =
    sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const status: StatusFilter = STATUS_VALUES.includes(
    (sp.status ?? '') as StatusFilter,
  )
    ? ((sp.status ?? 'all') as StatusFilter)
    : 'all'
  const sort: SortKey = SORT_VALUES.includes((sp.sort ?? '') as SortKey)
    ? ((sp.sort ?? 'recent') as SortKey)
    : 'recent'

  const result = q
    ? await searchSparksDiscoverAction({
        q,
        genre,
        status: status === 'all' ? undefined : status,
        sort,
        cursor: sp.cursor,
      })
    : null

  const data: { books: SparkCard[]; nextCursor: string | null } =
    result && result.success ? result.data : { books: [], nextCursor: null }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <Link
        href={`/${locale}/discover?tab=sparks`}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4"
      >
        <ArrowLeft size={12} /> Back to Sparks
      </Link>

      <header className="mb-5">
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">
          {q ? `Sparks for "${q}"` : 'Search Sparks'}
        </h1>
        {q && result && result.success && (
          <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
            {result.data.books.length} result
            {result.data.books.length === 1 ? '' : 's'}
          </p>
        )}
      </header>

      <div className="grid grid-cols-[240px_1fr] gap-6">
        <SparkSearchFilterRail
          q={q}
          activeGenre={genre}
          activeStatus={status}
          activeSort={sort}
          locale={locale}
        />
        <SparkSearchResults
          result={data}
          locale={locale}
          hasQuery={!!q}
        />
      </div>
    </main>
  )
}
