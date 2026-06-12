import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  searchClubsDiscoverAction,
  type ClubCard,
} from '@/lib/actions/discover-clubs.actions'
import { isValidGenre, type GenreSlug } from '@/lib/discover/genres'
import { ClubSearchFilterRail } from './_components/club-search-filter-rail'
import { ClubSearchResults } from './_components/club-search-results'

type SortKey = 'relevance' | 'recent' | 'most-active' | 'most-members'

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
  'most-active',
  'most-members',
]

export default async function ClubSearchPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const genre: GenreSlug | undefined =
    sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const sort: SortKey = SORT_VALUES.includes(sp.sort as SortKey)
    ? (sp.sort as SortKey)
    : 'recent'

  const result = q
    ? await searchClubsDiscoverAction({
        q,
        genre,
        sort,
        cursor: sp.cursor,
      })
    : null

  const data: { books: ClubCard[]; nextCursor: string | null } =
    result && result.success ? result.data : { books: [], nextCursor: null }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <Link
        href={`/${locale}/discover?tab=clubs`}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4"
      >
        <ArrowLeft size={12} /> Back to Clubs
      </Link>

      <header className="mb-5">
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">
          {q ? `Clubs for "${q}"` : 'Search Clubs'}
        </h1>
        {q && result && result.success && (
          <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
            {result.data.books.length} result
            {result.data.books.length === 1 ? '' : 's'}
          </p>
        )}
      </header>

      <div className="grid grid-cols-[240px_1fr] gap-6">
        <ClubSearchFilterRail
          q={q}
          activeGenre={genre}
          activeSort={sort}
          locale={locale}
        />
        <ClubSearchResults result={data} locale={locale} hasQuery={!!q} />
      </div>
    </main>
  )
}
