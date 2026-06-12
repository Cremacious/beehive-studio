import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  searchHivesDiscoverAction,
  type HiveCard,
  type SizeBucket,
} from '@/lib/actions/discover-hives.actions'
import { isValidGenre, type GenreSlug } from '@/lib/discover/genres'
import { HiveSearchFilterRail } from './_components/hive-search-filter-rail'
import { HiveSearchResults } from './_components/hive-search-results'

type SortKey = 'relevance' | 'recent' | 'most-active' | 'most-members'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    q?: string
    genre?: string
    size?: string
    sort?: string
    cursor?: string
  }>
}

const SIZE_VALUES: SizeBucket[] = ['any', 'small', 'mid', 'large']
const SORT_VALUES: SortKey[] = ['relevance', 'recent', 'most-active', 'most-members']

export default async function HiveSearchPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const genre: GenreSlug | undefined =
    sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const size: SizeBucket = SIZE_VALUES.includes(sp.size as SizeBucket)
    ? (sp.size as SizeBucket)
    : 'any'
  const sort: SortKey = SORT_VALUES.includes(sp.sort as SortKey)
    ? (sp.sort as SortKey)
    : 'recent'

  const result = q
    ? await searchHivesDiscoverAction({
        q,
        genre,
        size,
        sort,
        cursor: sp.cursor,
      })
    : null

  const data: { books: HiveCard[]; nextCursor: string | null } =
    result && result.success ? result.data : { books: [], nextCursor: null }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <Link
        href={`/${locale}/discover?tab=hives`}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4"
      >
        <ArrowLeft size={12} /> Back to Hives
      </Link>

      <header className="mb-5">
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">
          {q ? `Hives for "${q}"` : 'Search Hives'}
        </h1>
        {q && result && result.success && (
          <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
            {result.data.books.length} result
            {result.data.books.length === 1 ? '' : 's'}
          </p>
        )}
      </header>

      <div className="grid grid-cols-[240px_1fr] gap-6">
        <HiveSearchFilterRail
          q={q}
          activeGenre={genre}
          activeSize={size}
          activeSort={sort}
          locale={locale}
        />
        <HiveSearchResults
          result={data}
          locale={locale}
          hasQuery={!!q}
        />
      </div>
    </main>
  )
}
