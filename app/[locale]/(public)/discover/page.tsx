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
  type BookCard,
} from '@/lib/actions/discover.actions'
import {
  getFeaturedSparkAction,
  getLiveNowSparksAction,
  getVotingNowSparksAction,
  getHeatingUpSparksAction,
  getNewlyOpenedSparksAction,
  getFollowingSparksAction,
  getRecentlyWonSparksAction,
  getSparkGenreCountsAction,
  type SparkCard,
  type RailResult as SparkRailResult,
} from '@/lib/actions/discover-sparks.actions'
import { getDiscoverableHivesAction } from '@/lib/actions/hive.actions'
import { isValidGenre } from '@/lib/discover/genres'
import { PageHead } from '@/components/community/page-head'
import { DiscoverTabs } from './_components/tabs'
import { HiveCard } from './_components/hive-card'
import { ListsTabContent } from './_components/lists-tab-content'
import { ClubsTabContent } from './_components/clubs-tab-content'
import { FeaturedFreshHero } from './_components/featured-fresh-hero'
import { DiscoverRail } from './_components/discover-rail'
import { GenreChipStrip } from './_components/genre-chip-strip'
import { DiscoverSearchInput } from './_components/discover-search-input'
import { GenreFooterGrid } from './_components/genre-footer-grid'
import { FeaturedSparkHero } from './_components/featured-spark-hero'
import { DiscoverSparkRail } from './_components/discover-spark-rail'

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
      {tab === 'sparks' && <SparksTab locale={locale} genre={genre} />}
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

  const followingResult:
    | { success: true; data: RailResult<BookCard> }
    | { success: false; error: string } = following

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

type SparkFollowingFallback = { success: false; error: 'GUEST' }

async function SparksTab({ locale, genre }: { locale: string; genre?: string }) {
  const safeGenre = genre && isValidGenre(genre) ? genre : undefined

  const [
    hero,
    liveNow,
    votingNow,
    heatingUp,
    newlyOpened,
    following,
    recentlyWon,
    genreCounts,
  ] = await Promise.all([
    getFeaturedSparkAction({ genre: safeGenre }),
    getLiveNowSparksAction({ genre: safeGenre }),
    getVotingNowSparksAction({ genre: safeGenre }),
    getHeatingUpSparksAction({ genre: safeGenre }),
    getNewlyOpenedSparksAction({ genre: safeGenre }),
    getFollowingSparksAction({ genre: safeGenre }).catch(
      (): SparkFollowingFallback => ({ success: false, error: 'GUEST' }),
    ),
    getRecentlyWonSparksAction({ genre: safeGenre }),
    getSparkGenreCountsAction(),
  ])

  const followingResult:
    | { success: true; data: SparkRailResult<SparkCard> }
    | { success: false; error: string } = following

  return (
    <div className="flex flex-col gap-5">
      {hero.success && hero.data && (
        <FeaturedSparkHero spark={hero.data} locale={locale} />
      )}

      <div
        className="flex items-center gap-3 sticky top-0 z-10 py-3"
        style={{
          background: 'rgba(38,39,40,0.95)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <GenreChipStrip
          activeGenre={safeGenre}
          locale={locale}
          tabContext="sparks"
        />
        <div className="ml-auto">
          <DiscoverSearchInput
            locale={locale}
            searchHref={`/${locale}/discover/sparks/search`}
            placeholder="Search Sparks, prompts, creators..."
            ariaLabel="Search Discover Sparks"
          />
        </div>
      </div>

      {liveNow.success && (
        <DiscoverSparkRail
          title="Live now"
          subPageHref={`/${locale}/discover/sparks/live-now${qs(safeGenre)}`}
          result={liveNow.data}
          locale={locale}
          showUrgencyCaption
        />
      )}
      {votingNow.success && (
        <DiscoverSparkRail
          title="Voting now"
          subPageHref={`/${locale}/discover/sparks/voting-now${qs(safeGenre)}`}
          result={votingNow.data}
          locale={locale}
        />
      )}
      {heatingUp.success && (
        <DiscoverSparkRail
          title="Heating up"
          subPageHref={`/${locale}/discover/sparks/heating-up${qs(safeGenre)}`}
          result={heatingUp.data}
          locale={locale}
        />
      )}
      {newlyOpened.success && (
        <DiscoverSparkRail
          title="Newly opened"
          subPageHref={`/${locale}/discover/sparks/newly-opened${qs(safeGenre)}`}
          result={newlyOpened.data}
          locale={locale}
        />
      )}
      {followingResult.success && (
        <DiscoverSparkRail
          title="From writers you follow"
          subPageHref={`/${locale}/discover/sparks/following${qs(safeGenre)}`}
          result={followingResult.data}
          locale={locale}
          hideWhenEmpty
        />
      )}
      {recentlyWon.success && (
        <DiscoverSparkRail
          title="Recently won"
          subPageHref={`/${locale}/discover/sparks/recently-won${qs(safeGenre)}`}
          result={recentlyWon.data}
          locale={locale}
        />
      )}

      {genreCounts.success && (
        <GenreFooterGrid
          counts={genreCounts.data}
          locale={locale}
          linkBase={`/${locale}/discover/sparks/genre/`}
          title="Browse Sparks by genre"
          countLabel="sparks"
        />
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
