import { Suspense } from 'react'
import { getDiscoverFeedAction, getDiscoverWritersAction } from '@/lib/actions/discover.actions'
import { FeedFilters } from './_components/feed-filters'
import { WritersStrip } from './_components/writers-strip'
import { LoadMoreFeed } from './_components/load-more-feed'

type Props = {
  searchParams: Promise<{ sort?: string; genre?: string; page?: string }>
}

export default async function DiscoverPage({ searchParams }: Props) {
  const params = await searchParams
  const sort = (params.sort === 'popular' || params.sort === 'new') ? params.sort : 'trending'
  const genre = params.genre

  const [feedResult, writersResult] = await Promise.all([
    getDiscoverFeedAction(sort, genre, 1),
    getDiscoverWritersAction(),
  ])

  const books = feedResult.success ? feedResult.data.books : []
  const hasMore = feedResult.success ? feedResult.data.hasMore : false
  const writers = (writersResult.success && !genre) ? writersResult.data : []

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="px-6 pt-8 pb-0">
        <h1 className="text-2xl font-semibold text-white mb-1">Discover</h1>
        <p className="text-[#666] text-[13px]">Explore books and writers from the Hive</p>
      </div>

      <div className="mt-4">
        <Suspense fallback={<div className="h-[88px] border-b border-[#2a2a2a]" />}>
          <FeedFilters currentSort={sort} currentGenre={genre} />
        </Suspense>
      </div>

      <div className="px-6 py-5">
        {books.length === 0 ? (
          <div className="text-center py-20 text-[#555]">
            No books found for this filter.
          </div>
        ) : (
          <LoadMoreFeed
            initialBooks={books}
            initialHasMore={hasMore}
            sort={sort}
            genre={genre}
          />
        )}

        {writers.length > 0 && (
          <div className="mt-6">
            <WritersStrip writers={writers} />
          </div>
        )}
      </div>
    </div>
  )
}
