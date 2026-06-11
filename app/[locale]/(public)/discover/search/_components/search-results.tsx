import Link from 'next/link'
import { DiscoverBookCard } from '../../_components/discover-book-card'
import type { BookCard } from '@/lib/actions/discover.actions'

type Props = {
  result: { books: BookCard[]; nextCursor: string | null }
  locale: string
  hasQuery: boolean
  q?: string
  genre?: string
  tag?: string
  sort?: 'recent' | 'popular' | 'relevance'
}

export function SearchResults({
  result,
  locale,
  hasQuery,
  q,
  genre,
  tag,
  sort,
}: Props) {
  if (!hasQuery) {
    return (
      <p className="text-[13px] text-[var(--canvas-dark-ink-muted)] italic py-12 text-center">
        Type something to search.
      </p>
    )
  }

  if (result.books.length === 0) {
    return (
      <p className="text-[13px] text-[var(--canvas-dark-ink-muted)] italic py-12 text-center">
        No books match that search. Try a genre or a different tag.
      </p>
    )
  }

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3">
        {result.books.map((book) => (
          <li key={book.id}>
            <DiscoverBookCard book={book} locale={locale} variant="grid" />
          </li>
        ))}
      </ul>
      {result.nextCursor && (
        <LoadMoreLink
          locale={locale}
          cursor={result.nextCursor}
          q={q}
          genre={genre}
          tag={tag}
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
  tag,
  sort,
}: {
  locale: string
  cursor: string
  q?: string
  genre?: string
  tag?: string
  sort?: 'recent' | 'popular' | 'relevance'
}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (genre) params.set('genre', genre)
  if (tag) params.set('tag', tag)
  if (sort) params.set('sort', sort)
  params.set('cursor', cursor)

  return (
    <div className="mt-6 flex justify-center">
      <Link
        href={`/${locale}/discover/search?${params.toString()}`}
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
