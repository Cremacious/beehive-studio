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
            className="px-8 py-2.5 bg-transparent border border-[#2a2a2a] text-[#888] rounded-md text-[13px] hover:border-[#3a3a3a] hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? 'Loading…' : 'Load more books'}
          </button>
        </div>
      )}
    </div>
  )
}
