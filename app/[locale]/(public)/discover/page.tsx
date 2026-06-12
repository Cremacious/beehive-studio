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
import {
  getFeaturedHiveAction,
  getTrendingHivesAction,
  getRecentlyActiveHivesAction,
  getNewHivesAction,
  getLookingForCollaboratorsHivesAction,
  getFollowingHivesAction,
  getHiveGenreCountsAction,
  type HiveCard as HiveCardType,
  type RailResult as HiveRailResult,
} from '@/lib/actions/discover-hives.actions'
import {
  getFeaturedListAction,
  getTrendingListsAction,
  getRecentlyUpdatedListsAction,
  getNewListsAction,
  getMostFollowedListsAction,
  getFollowingListsAction,
  getListGenreCountsAction,
  type ListCard as ListCardType,
  type RailResult as ListRailResult,
} from '@/lib/actions/discover-lists.actions'
import {
  getFeaturedClubAction,
  getTrendingClubsAction,
  getActiveClubsAction,
  getNewClubsAction,
  getOpenToJoinClubsAction,
  getFollowingClubsAction,
  getClubGenreCountsAction,
  type ClubCard as ClubCardType,
  type RailResult as ClubRailResult,
} from '@/lib/actions/discover-clubs.actions'
import { isValidGenre } from '@/lib/discover/genres'
import { PageHead } from '@/components/community/page-head'
import { DiscoverTabs } from './_components/tabs'
import { FeaturedFreshHero } from './_components/featured-fresh-hero'
import { DiscoverRail } from './_components/discover-rail'
import { GenreChipStrip } from './_components/genre-chip-strip'
import { DiscoverSearchInput } from './_components/discover-search-input'
import { GenreFooterGrid } from './_components/genre-footer-grid'
import { FeaturedSparkHero } from './_components/featured-spark-hero'
import { DiscoverSparkRail } from './_components/discover-spark-rail'
import { FeaturedHiveHero } from './_components/featured-hive-hero'
import { DiscoverHiveRail } from './_components/discover-hive-rail'
import { FeaturedListHero } from './_components/featured-list-hero'
import { DiscoverListRail } from './_components/discover-list-rail'
import { FeaturedClubHero } from './_components/featured-club-hero'
import { DiscoverClubRail } from './_components/discover-club-rail'

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
      {tab === 'hives' && <HivesTab locale={locale} genre={genre} />}
      {tab === 'lists' && <ListsTab locale={locale} genre={genre} />}
      {tab === 'clubs' && <ClubsTab locale={locale} genre={genre} />}
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

type ListFollowingFallback = { success: false; error: 'GUEST' }

async function ListsTab({ locale, genre }: { locale: string; genre?: string }) {
  const safeGenre = genre && isValidGenre(genre) ? genre : undefined

  const [
    hero,
    trending,
    recentlyUpdated,
    newLists,
    mostFollowed,
    following,
    genreCounts,
  ] = await Promise.all([
    getFeaturedListAction({ genre: safeGenre }),
    getTrendingListsAction({ genre: safeGenre }),
    getRecentlyUpdatedListsAction({ genre: safeGenre }),
    getNewListsAction({ genre: safeGenre }),
    getMostFollowedListsAction({ genre: safeGenre }),
    getFollowingListsAction({ genre: safeGenre }).catch(
      (): ListFollowingFallback => ({ success: false, error: 'GUEST' }),
    ),
    getListGenreCountsAction(),
  ])

  const followingResult:
    | { success: true; data: ListRailResult<ListCardType> }
    | { success: false; error: string } = following

  return (
    <div className="flex flex-col gap-5">
      {hero.success && hero.data && <FeaturedListHero list={hero.data} locale={locale} />}

      <div
        className="flex items-center gap-3 sticky top-0 z-10 py-3"
        style={{
          background: 'rgba(38,39,40,0.95)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <GenreChipStrip activeGenre={safeGenre} locale={locale} tabContext="lists" />
        <div className="ml-auto">
          <DiscoverSearchInput
            locale={locale}
            searchHref={`/${locale}/discover/lists/search`}
            placeholder="Search Lists, curators, books..."
            ariaLabel="Search Discover Lists"
          />
        </div>
      </div>

      {trending.success && (
        <DiscoverListRail
          title="Trending"
          subPageHref={`/${locale}/discover/lists/trending${qs(safeGenre)}`}
          result={trending.data}
          locale={locale}
        />
      )}
      {recentlyUpdated.success && (
        <DiscoverListRail
          title="Recently updated"
          subPageHref={`/${locale}/discover/lists/recently-updated${qs(safeGenre)}`}
          result={recentlyUpdated.data}
          locale={locale}
        />
      )}
      {newLists.success && (
        <DiscoverListRail
          title="New"
          subPageHref={`/${locale}/discover/lists/new${qs(safeGenre)}`}
          result={newLists.data}
          locale={locale}
        />
      )}
      {mostFollowed.success && (
        <DiscoverListRail
          title="Most followed"
          subPageHref={`/${locale}/discover/lists/most-followed${qs(safeGenre)}`}
          result={mostFollowed.data}
          locale={locale}
        />
      )}
      {followingResult.success && (
        <DiscoverListRail
          title="From writers you follow"
          subPageHref={`/${locale}/discover/lists/following${qs(safeGenre)}`}
          result={followingResult.data}
          locale={locale}
          hideWhenEmpty
        />
      )}

      {genreCounts.success && (
        <GenreFooterGrid
          counts={genreCounts.data}
          locale={locale}
          linkBase={`/${locale}/discover/lists/genre/`}
          title="Browse Lists by genre"
          countLabel="lists"
        />
      )}
    </div>
  )
}

type ClubFollowingFallback = { success: false; error: 'GUEST' }

async function ClubsTab({ locale, genre }: { locale: string; genre?: string }) {
  const safeGenre = genre && isValidGenre(genre) ? genre : undefined

  const [hero, trending, active, newClubs, openToJoin, following, genreCounts] =
    await Promise.all([
      getFeaturedClubAction({ genre: safeGenre }),
      getTrendingClubsAction({ genre: safeGenre }),
      getActiveClubsAction({ genre: safeGenre }),
      getNewClubsAction({ genre: safeGenre }),
      getOpenToJoinClubsAction({ genre: safeGenre }),
      getFollowingClubsAction({ genre: safeGenre }).catch(
        (): ClubFollowingFallback => ({ success: false, error: 'GUEST' }),
      ),
      getClubGenreCountsAction(),
    ])

  const followingResult:
    | { success: true; data: ClubRailResult<ClubCardType> }
    | { success: false; error: string } = following

  return (
    <div className="flex flex-col gap-5">
      {hero.success && hero.data && (
        <FeaturedClubHero club={hero.data} locale={locale} />
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
          tabContext="clubs"
        />
        <div className="ml-auto">
          <DiscoverSearchInput
            locale={locale}
            searchHref={`/${locale}/discover/clubs/search`}
            placeholder="Search Clubs, communities, owners..."
            ariaLabel="Search Discover Clubs"
          />
        </div>
      </div>

      {trending.success && (
        <DiscoverClubRail
          title="Trending"
          subPageHref={`/${locale}/discover/clubs/trending${qs(safeGenre)}`}
          result={trending.data}
          locale={locale}
        />
      )}
      {active.success && (
        <DiscoverClubRail
          title="Active"
          subPageHref={`/${locale}/discover/clubs/active${qs(safeGenre)}`}
          result={active.data}
          locale={locale}
        />
      )}
      {newClubs.success && (
        <DiscoverClubRail
          title="New"
          subPageHref={`/${locale}/discover/clubs/new${qs(safeGenre)}`}
          result={newClubs.data}
          locale={locale}
        />
      )}
      {openToJoin.success && (
        <DiscoverClubRail
          title="Open to join"
          subPageHref={`/${locale}/discover/clubs/open-to-join${qs(safeGenre)}`}
          result={openToJoin.data}
          locale={locale}
        />
      )}
      {followingResult.success && (
        <DiscoverClubRail
          title="From writers you follow"
          subPageHref={`/${locale}/discover/clubs/following${qs(safeGenre)}`}
          result={followingResult.data}
          locale={locale}
          hideWhenEmpty
        />
      )}

      {genreCounts.success && (
        <GenreFooterGrid
          counts={genreCounts.data}
          locale={locale}
          linkBase={`/${locale}/discover/clubs/genre/`}
          title="Browse Clubs by genre"
          countLabel="clubs"
        />
      )}
    </div>
  )
}

type HiveFollowingFallback = { success: false; error: 'GUEST' }

async function HivesTab({ locale, genre }: { locale: string; genre?: string }) {
  const safeGenre = genre && isValidGenre(genre) ? genre : undefined

  const [
    hero,
    trending,
    recentlyActive,
    newHives,
    lookingForCollab,
    following,
    genreCounts,
  ] = await Promise.all([
    getFeaturedHiveAction({ genre: safeGenre }),
    getTrendingHivesAction({ genre: safeGenre }),
    getRecentlyActiveHivesAction({ genre: safeGenre }),
    getNewHivesAction({ genre: safeGenre }),
    getLookingForCollaboratorsHivesAction({ genre: safeGenre }),
    getFollowingHivesAction({ genre: safeGenre }).catch(
      (): HiveFollowingFallback => ({ success: false, error: 'GUEST' }),
    ),
    getHiveGenreCountsAction(),
  ])

  const followingResult:
    | { success: true; data: HiveRailResult<HiveCardType> }
    | { success: false; error: string } = following

  return (
    <div className="flex flex-col gap-5">
      {hero.success && hero.data && <FeaturedHiveHero hive={hero.data} locale={locale} />}

      <div
        className="flex items-center gap-3 sticky top-0 z-10 py-3"
        style={{
          background: 'rgba(38,39,40,0.95)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <GenreChipStrip activeGenre={safeGenre} locale={locale} tabContext="hives" />
        <div className="ml-auto">
          <DiscoverSearchInput
            locale={locale}
            searchHref={`/${locale}/discover/hives/search`}
            placeholder="Search Hives, communities, owners..."
            ariaLabel="Search Discover Hives"
          />
        </div>
      </div>

      {trending.success && (
        <DiscoverHiveRail
          title="Trending now"
          subPageHref={`/${locale}/discover/hives/trending${qs(safeGenre)}`}
          result={trending.data}
          locale={locale}
        />
      )}
      {recentlyActive.success && (
        <DiscoverHiveRail
          title="Recently active"
          subPageHref={`/${locale}/discover/hives/recently-active${qs(safeGenre)}`}
          result={recentlyActive.data}
          locale={locale}
        />
      )}
      {newHives.success && (
        <DiscoverHiveRail
          title="New communities"
          subPageHref={`/${locale}/discover/hives/new${qs(safeGenre)}`}
          result={newHives.data}
          locale={locale}
        />
      )}
      {lookingForCollab.success && (
        <DiscoverHiveRail
          title="Looking for collaborators"
          subPageHref={`/${locale}/discover/hives/looking-for-collaborators${qs(safeGenre)}`}
          result={lookingForCollab.data}
          locale={locale}
        />
      )}
      {followingResult.success && (
        <DiscoverHiveRail
          title="From writers you follow"
          subPageHref={`/${locale}/discover/hives/following${qs(safeGenre)}`}
          result={followingResult.data}
          locale={locale}
          hideWhenEmpty
        />
      )}

      {genreCounts.success && (
        <GenreFooterGrid
          counts={genreCounts.data}
          locale={locale}
          linkBase={`/${locale}/discover/hives/genre/`}
          title="Browse Hives by genre"
          countLabel="hives"
        />
      )}
    </div>
  )
}
