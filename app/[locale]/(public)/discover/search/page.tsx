import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  searchBooksDiscoverAction,
  type BookCard,
} from '@/lib/actions/discover.actions'
import { isValidGenre, type GenreSlug } from '@/lib/discover/genres'
import { SearchFilterRail } from './_components/search-filter-rail'
import { SearchResults } from './_components/search-results'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    q?: string
    genre?: string
    tag?: string
    sort?: string
    cursor?: string
  }>
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const genre: GenreSlug | undefined =
    sp.genre && isValidGenre(sp.genre) ? sp.genre : undefined
  const tag = sp.tag?.trim() || undefined
  const sort: 'recent' | 'popular' | 'relevance' =
    sp.sort === 'popular' || sp.sort === 'relevance' ? sp.sort : 'recent'

  const result = q
    ? await searchBooksDiscoverAction({ q, genre, tag, sort, cursor: sp.cursor })
    : null

  const data: { books: BookCard[]; nextCursor: string | null } =
    result && result.success ? result.data : { books: [], nextCursor: null }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <Link
        href={`/${locale}/discover`}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] text-[var(--canvas-dark-ink-muted)] hover:text-[var(--brand)] mb-4"
      >
        <ArrowLeft size={12} /> Back to Discover
      </Link>

      <header className="mb-5">
        <h1 className="font-[family-name:var(--font-comfortaa)] font-bold text-[28px] text-[var(--brand)]">
          {q ? `Results for "${q}"` : 'Search Discover'}
        </h1>
        {q && result && result.success && (
          <p className="text-[13px] text-[var(--canvas-dark-ink-muted)]">
            {result.data.books.length} result
            {result.data.books.length === 1 ? '' : 's'}
          </p>
        )}
      </header>

      <div className="grid grid-cols-[240px_1fr] gap-6">
        <SearchFilterRail
          q={q}
          activeGenre={genre}
          activeTag={tag}
          activeSort={sort}
          locale={locale}
        />
        <SearchResults
          result={data}
          locale={locale}
          hasQuery={!!q}
          q={q}
          genre={genre}
          tag={tag}
          sort={sort}
        />
      </div>
    </main>
  )
}
