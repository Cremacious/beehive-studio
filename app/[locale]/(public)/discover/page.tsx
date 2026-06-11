import Link from 'next/link'
import {
  getFeaturedFreshBookAction,
  getTrendingBooksAction,
  getRisingStarsBooksAction,
  getRecentlyUpdatedBooksAction,
  getNewReleasesBooksAction,
  getBestOngoingBooksAction,
  getFollowingFeedAction,
  getGenreBookCountsAction,
  type RailResult,
} from '@/lib/actions/discover.actions'
import { getSparksAction } from '@/lib/actions/sparks.actions'
import { getDiscoverableHivesAction } from '@/lib/actions/hive.actions'
import { isValidGenre } from '@/lib/discover/genres'
import { PageHead } from '@/components/community/page-head'
import { DiscoverTabs } from './_components/tabs'
import { SparkCard } from './_components/spark-card'
import { HiveCard } from './_components/hive-card'
import { CreateSparkModal } from './_components/create-spark-modal'
import { ListsTabContent } from './_components/lists-tab-content'
import { ClubsTabContent } from './_components/clubs-tab-content'
import { FeaturedFreshHero } from './_components/featured-fresh-hero'
import { DiscoverRail } from './_components/discover-rail'
import { GenreChipStrip } from './_components/genre-chip-strip'
import { DiscoverSearchInput } from './_components/discover-search-input'
import { GenreFooterGrid } from './_components/genre-footer-grid'

type Tab = 'books' | 'sparks' | 'hives' | 'lists' | 'clubs'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tab?: string; genre?: string }>
}

export default async function DiscoverPage({ params, searchParams }: Props) {
  const { locale } = await params
  const resolved = await searchParams
  const tab: Tab =
    resolved.tab === 'sparks' ||
    resolved.tab === 'hives' ||
    resolved.tab === 'lists' ||
    resolved.tab === 'clubs'
      ? resolved.tab
      : 'books'
  const rawGenre = typeof resolved.genre === 'string' ? resolved.genre : undefined
  const genre = rawGenre && isValidGenre(rawGenre) ? rawGenre : undefined

  return (
    <main className="cm-wrap max-w-7xl mx-auto">
      <PageHead
        eyebrow="Find your next read & your next circle"
        title="Discover"
        subtitle="Books, sparks, lists, clubs, and hives from across the community."
      />

      <div className="mb-5">
        <DiscoverTabs currentTab={tab} />
      </div>

      {tab === 'books' && <BooksTab locale={locale} genre={genre} />}
      {tab === 'sparks' && <SparksTab locale={locale} />}
      {tab === 'hives' && <HivesTab locale={locale} />}
      {tab === 'lists' && <ListsTab locale={locale} />}
      {tab === 'clubs' && <ClubsTab locale={locale} />}
    </main>
  )
}

function qs(genre: string | undefined): string {
  return genre ? `?genre=${encodeURIComponent(genre)}` : ''
}

type FollowingFallback = { success: false; error: 'GUEST' }

async function BooksTab({ locale, genre }: { locale: string; genre?: string }) {
  const [
    hero,
    trending,
    rising,
    recentlyUpdated,
    newReleases,
    bestOngoing,
    following,
    genreCounts,
  ] = await Promise.all([
    getFeaturedFreshBookAction({ genre }),
    getTrendingBooksAction({ genre }),
    getRisingStarsBooksAction({ genre }),
    getRecentlyUpdatedBooksAction({ genre }),
    getNewReleasesBooksAction({ genre }),
    getBestOngoingBooksAction({ genre }),
    getFollowingFeedAction({ genre }).catch(
      (): FollowingFallback => ({ success: false, error: 'GUEST' }),
    ),
    getGenreBookCountsAction(),
  ])

  const followingResult: { success: true; data: RailResult } | { success: false; error: string } =
    following

  return (
    <div className="flex flex-col gap-5">
      {hero.success && hero.data && <FeaturedFreshHero book={hero.data} locale={locale} />}

      <div
        className="flex items-center gap-3 sticky top-0 z-10 py-3"
        style={{
          background: 'rgba(38,39,40,0.95)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <GenreChipStrip activeGenre={genre} locale={locale} />
        <div className="ml-auto">
          <DiscoverSearchInput locale={locale} />
        </div>
      </div>

      {trending.success && (
        <DiscoverRail
          title="Trending Now"
          subPageHref={`/${locale}/discover/trending${qs(genre)}`}
          result={trending.data}
          locale={locale}
        />
      )}
      {rising.success && (
        <DiscoverRail
          title="Rising Stars"
          subPageHref={`/${locale}/discover/rising${qs(genre)}`}
          result={rising.data}
          locale={locale}
        />
      )}
      {recentlyUpdated.success && (
        <DiscoverRail
          title="Recently Updated"
          subPageHref={`/${locale}/discover/recently-updated${qs(genre)}`}
          result={recentlyUpdated.data}
          locale={locale}
        />
      )}
      {newReleases.success && (
        <DiscoverRail
          title="New Releases"
          subPageHref={`/${locale}/discover/new-releases${qs(genre)}`}
          result={newReleases.data}
          locale={locale}
        />
      )}
      {bestOngoing.success && (
        <DiscoverRail
          title="Best Ongoing"
          subPageHref={`/${locale}/discover/best-ongoing${qs(genre)}`}
          result={bestOngoing.data}
          locale={locale}
        />
      )}
      {followingResult.success && (
        <DiscoverRail
          title="From Authors You Follow"
          subPageHref={`/${locale}/discover/following${qs(genre)}`}
          result={followingResult.data}
          locale={locale}
          hideWhenEmpty
        />
      )}

      {genreCounts.success && <GenreFooterGrid counts={genreCounts.data} locale={locale} />}
    </div>
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
