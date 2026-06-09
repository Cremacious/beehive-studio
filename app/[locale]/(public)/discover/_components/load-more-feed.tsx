'use client'

import { useState, useTransition } from 'react'
import { getDiscoverFeedAction } from '@/lib/actions/discover.actions'
import { BookCard } from './book-card'
import type { DiscoverBook } from '@/lib/actions/discover.actions'

type Props = {
  initialBooks: DiscoverBook[]
  initialHasMore: boolean
  sort: string
  genre: string | undefined
  locale: string
}

export function LoadMoreFeed({ initialBooks, initialHasMore, sort, genre, locale }: Props) {
  const [books, setBooks] = useState(initialBooks)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [page, setPage] = useState(1)
  const [isPending, startTransition] = useTransition()

  const loadMore = () => {
    startTransition(async () => {
      const nextPage = page + 1
      const result = await getDiscoverFeedAction(
        sort as 'trending' | 'popular' | 'new',
        genre,
        nextPage
      )
      if (result.success) {
        setBooks(prev => [...prev, ...result.data.books])
        setHasMore(result.data.hasMore)
        setPage(nextPage)
      }
    })
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-4">
        {books.map(book => (
          <BookCard key={book.id} book={book} locale={locale} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 h-9 px-6 rounded-[var(--r-pill)] text-[13px] font-semibold cursor-pointer disabled:opacity-50 transition-colors text-[var(--canvas-dark-ink-strong)] hover:bg-[var(--canvas-dark-300)]"
            style={{
              background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              boxShadow: 'var(--sh-tile)',
              borderTop: 'var(--br-card)',
            }}
          >
            {isPending ? 'Loading…' : 'Load more books'}
          </button>
        </div>
      )}
    </div>
  )
}
