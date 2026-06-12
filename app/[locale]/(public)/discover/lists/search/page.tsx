import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  searchListsDiscoverAction,
  type ListCard,
} from '@/lib/actions/discover-lists.actions'
import { isValidGenre, type GenreSlug } from '@/lib/discover/genres'
import { ListSearchFilterRail } from './_components/list-search-filter-rail'
import { ListSearchResults } from './_components/list-search-results'

type SortKey = 'relevance' | 'recent' | 'most-followed' | 'most-books'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    q?: string
    genre?: string
    sort?: string
    cursor?: string
  }>
}

const SORT_VALUES: SortKey[] = [
  'relevance',
  'recent',
  'most-followed',
  'most-books',
]

export default async function ListSearchPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const genre: GenreSlug | undefined =
    sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const sort: SortKey = SORT_VALUES.includes(sp.sort as SortKey)
    ? (sp.sort as SortKey)
    : 'recent'

  const result = q
    ? await searchListsDiscoverAction({
        q,
        genre,
        sort,
        cursor: sp.cursor,
      })
    : null

  const data: { books: ListCard[]; nextCursor: string | null } =
    result && result.success ? result.data : { books: [], nextCursor: null }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <Link
        href={`/${locale}/discover?tab=lists`}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4"
      >
        <ArrowLeft size={12} /> Back to Lists
      </Link>

      <header className="mb-5">
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">
          {q ? `Lists for "${q}"` : 'Search Lists'}
        </h1>
        {q && result && result.success && (
          <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
            {result.data.books.length} result
            {result.data.books.length === 1 ? '' : 's'}
          </p>
        )}
      </header>

      <div className="grid grid-cols-[240px_1fr] gap-6">
        <ListSearchFilterRail
          q={q}
          activeGenre={genre}
          activeSort={sort}
          locale={locale}
        />
        <ListSearchResults result={data} locale={locale} hasQuery={!!q} />
      </div>
    </main>
  )
}
