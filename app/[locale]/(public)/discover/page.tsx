import { Suspense } from 'react'
import Link from 'next/link'
import { getDiscoverFeedAction, getDiscoverWritersAction } from '@/lib/actions/discover.actions'
import { getSparksAction } from '@/lib/actions/sparks.actions'
import { getDiscoverableHivesAction } from '@/lib/actions/hive.actions'
import { PageHead } from '@/components/community/page-head'
import { FeedFilters } from './_components/feed-filters'
import { WritersStrip } from './_components/writers-strip'
import { LoadMoreFeed } from './_components/load-more-feed'
import { DiscoverTabs } from './_components/tabs'
import { SparkCard } from './_components/spark-card'
import { HiveCard } from './_components/hive-card'
import { CreateSparkModal } from './_components/create-spark-modal'
import { ListsTabContent } from './_components/lists-tab-content'
import { ClubsTabContent } from './_components/clubs-tab-content'

type Tab = 'books' | 'sparks' | 'hives' | 'lists' | 'clubs'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string; sort?: string; genre?: string }>
}

export default async function DiscoverPage({ params, searchParams }: Props) {
  const { locale } = await params
  const resolved = await searchParams
  const tab: Tab = (resolved.tab === 'sparks' || resolved.tab === 'hives' || resolved.tab === 'lists' || resolved.tab === 'clubs') ? resolved.tab : 'books'
  const sort: 'trending' | 'popular' | 'new' = (resolved.sort === 'popular' || resolved.sort === 'new') ? resolved.sort : 'trending'
  const genre = resolved.genre

  return (
    <main className="cm-wrap w-5xl">
      <PageHead
        eyebrow="Find your next read & your next circle"
        title="Discover"
        subtitle="Books, sparks, lists, clubs, and hives from across the community."
      />

      <div className="mb-5">
        <DiscoverTabs currentTab={tab} />
      </div>

      {tab === 'books' && <BooksTab locale={locale} sort={sort} genre={genre} />}
      {tab === 'sparks' && <SparksTab locale={locale} />}
      {tab === 'hives' && <HivesTab locale={locale} />}
      {tab === 'lists' && <ListsTab locale={locale} />}
      {tab === 'clubs' && <ClubsTab locale={locale} />}
    </main>
  )
}

async function BooksTab({ locale, sort, genre }: { locale: string; sort: 'trending' | 'popular' | 'new'; genre?: string }) {
  const [feedResult, writersResult] = await Promise.all([
    getDiscoverFeedAction(sort, genre, 1),
    getDiscoverWritersAction(),
  ])

  const books = feedResult.success ? feedResult.data.books : []
  const hasMore = feedResult.success ? feedResult.data.hasMore : false
  const writers = (writersResult.success && !genre) ? writersResult.data : []

  return (
    <>
      <div className="mb-4">
        <Suspense fallback={<div className="h-[88px] border-b border-[var(--br-card)]" />}>
          <FeedFilters currentSort={sort} currentGenre={genre} />
        </Suspense>
      </div>

      <div>
        {books.length === 0 ? (
          <div className="text-center py-20 text-[var(--canvas-dark-ink-muted)] text-[13px]">
            No books found for this filter.
          </div>
        ) : (
          <LoadMoreFeed
            initialBooks={books}
            initialHasMore={hasMore}
            sort={sort}
            genre={genre}
            locale={locale}
          />
        )}

        {writers.length > 0 && (
          <div className="mt-6">
            <WritersStrip writers={writers} />
          </div>
        )}
      </div>
    </>
  )
}

async function SparksTab({ locale }: { locale: string }) {
  const [activeResult, closedResult] = await Promise.all([
    getSparksAction('active'),
    getSparksAction('closed'),
  ])
  const activeSparks = activeResult.success ? activeResult.data.sparks : []
  const closedSparks = closedResult.success ? closedResult.data.sparks : []

  return (
    <div>
      {/* Active Sparks grid */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[var(--canvas-dark-ink-muted)] text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)]">Active Sparks</p>
        <CreateSparkModal locale={locale} />
      </div>
      {activeSparks.length === 0 ? (
        <p className="text-[var(--canvas-dark-ink-muted)] text-[13px] py-8 text-center">No active Sparks yet. Create one!</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-8">
          {activeSparks.map(spark => <SparkCard key={spark.id} spark={spark} locale={locale} />)}
        </div>
      )}

      {/* Past Sparks */}
      {closedSparks.length > 0 && (
        <>
          <p className="text-[var(--canvas-dark-ink-muted)] text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] mb-3">Past Sparks</p>
          <div className="flex flex-col gap-2">
            {closedSparks.map(spark => (
              <Link key={spark.id} href={`/${locale}/sparks/${spark.id}`} className="flex items-center gap-3 py-2.5 border-b border-[var(--br-card)] hover:bg-[var(--canvas-dark-200)] px-2 rounded transition-colors">
                <p className="text-[var(--canvas-dark-ink)] text-[13px] flex-1 truncate">&ldquo;{spark.prompt}&rdquo;</p>
                {spark.winnerUsername && (
                  <span className="text-[var(--brand)] text-[11px] shrink-0">🏆 {spark.winnerUsername}</span>
                )}
                <span className="text-[var(--canvas-dark-ink-muted)] text-[11px] shrink-0">{spark.entryCount} entries</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

async function ListsTab({ locale }: { locale: string }) {
  return (
    <div>
      <p className="text-[var(--canvas-dark-ink-muted)] text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] mb-4">Discoverable Reading Lists</p>
      <ListsTabContent locale={locale} />
    </div>
  )
}

async function ClubsTab({ locale }: { locale: string }) {
  return (
    <div>
      <p className="text-[var(--canvas-dark-ink-muted)] text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] mb-4">Discoverable Book Clubs</p>
      <ClubsTabContent locale={locale} />
    </div>
  )
}

async function HivesTab({ locale }: { locale: string }) {
  const result = await getDiscoverableHivesAction()
  const hives = result.success ? result.data : []

  return (
    <div>
      <p className="text-[var(--canvas-dark-ink-muted)] text-[11px] uppercase tracking-wider font-[family-name:var(--font-mono)] mb-4">Public Hives</p>
      {hives.length === 0 ? (
        <p className="text-[var(--canvas-dark-ink-muted)] text-[13px] py-8 text-center">No public Hives yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {hives.map(hive => <HiveCard key={hive.id} hive={hive} locale={locale} />)}
        </div>
      )}
    </div>
  )
}
