import { redirect } from 'next/navigation'
import { getOptionalUserId } from '@/lib/require-auth'
import {
  parseRadio,
  parseIntParam,
  parseMultiSelect,
} from '@/lib/discover/url-state'
import {
  getCommunityListsAction,
  getTopListTagsAction,
  type CommunityListsTab,
  type CommunityListsSort,
} from '@/lib/actions/reading-lists-hub.actions'
import { CreateListButton } from './_components/create-list-button'
import { ListsTabStrip } from './_components/lists-tab-strip'
import { ListsSortDropdown } from './_components/lists-sort-dropdown'
import { ListsHubPagination } from './_components/lists-hub-pagination'
import { ListsRightRail } from './_components/lists-right-rail'
import { ListsGrid } from './_components/lists-grid'
import { ListsTagFilterStrip } from './_components/lists-tag-filter-strip'
import { BackToCommunity } from '@/components/community/back-to-community'
import { ActiveFilterChips } from '@/app/[locale]/(public)/discover/_components/active-filter-chips'

type SP = Record<string, string | string[] | undefined>
type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<SP>
}

const PAGE_SIZE = 9

function pickRaw(sp: SP, key: string): string | undefined {
  const v = sp[key]
  return typeof v === 'string' ? v : undefined
}

export const metadata = { title: 'Reading lists' }

export default async function ReadingListsHubPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params
  const sp = await searchParams

  // Auth gate — hub is personal-by-definition, guests redirect to sign-in.
  const viewerId = await getOptionalUserId()
  if (!viewerId) {
    redirect(
      `/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/community/reading-lists`)}`,
    )
  }

  const tab = parseRadio(
    pickRaw(sp, 'tab'),
    ['all', 'yours', 'following', 'liked'] as const,
    'all',
  )
  const sort = parseRadio(
    pickRaw(sp, 'sort'),
    ['recent', 'most-followed', 'a-z', 'most-books'] as const,
    'recent',
  )
  const page = Math.max(1, parseIntParam(pickRaw(sp, 'page'), 1))
  // Issue #22: canonical multi-tag URL is `?tags=a,b`. The legacy `?tag=X`
  // single-tag form (from the earlier hub-only ship) is read transitionally
  // and merged in so old links keep working; new clicks always emit `?tags=`.
  const tagsFromMulti = parseMultiSelect(pickRaw(sp, 'tags')).map((t) =>
    t.toLowerCase(),
  )
  const legacySingleTag = pickRaw(sp, 'tag')?.trim().toLowerCase()
  const tagFilters = Array.from(
    new Set<string>(
      [
        ...tagsFromMulti,
        ...(legacySingleTag ? [legacySingleTag] : []),
      ].filter((t) => t.length > 0),
    ),
  )

  // Parallel-fetch the visible page slice + the 3 other bucket totalCounts so
  // the tab strip can display per-tab counts. Each call is independently
  // bucket-scoped (totalCount on a tab call reflects only that tab's bucket).
  // Trade: 4 round-trips of an already-light aggregator vs one inline counts
  // helper. Per-bucket calls re-use the same projection, keep call sites
  // shape-aligned with /sparks and /hives, and avoid forking the action.
  const tagsArg = tagFilters.length > 0 ? tagFilters : undefined
  const [resultAll, resultYours, resultFollowing, resultLiked, topTagsResult] =
    await Promise.all([
      getCommunityListsAction({
        viewerId,
        tab: 'all',
        sort,
        page: tab === 'all' ? page : 1,
        tags: tagsArg,
      }),
      getCommunityListsAction({
        viewerId,
        tab: 'yours',
        sort,
        page: tab === 'yours' ? page : 1,
        tags: tagsArg,
      }),
      getCommunityListsAction({
        viewerId,
        tab: 'following',
        sort,
        page: tab === 'following' ? page : 1,
        tags: tagsArg,
      }),
      getCommunityListsAction({
        viewerId,
        tab: 'liked',
        sort,
        page: tab === 'liked' ? page : 1,
        tags: tagsArg,
      }),
      getTopListTagsAction({ limit: 20 }),
    ])
  const topTags = topTagsResult.success ? topTagsResult.data : []

  const bucketResults: Record<
    CommunityListsTab,
    typeof resultAll
  > = {
    all: resultAll,
    yours: resultYours,
    following: resultFollowing,
    liked: resultLiked,
  }

  const active = bucketResults[tab]
  if (!active.success) {
    return (
      <main
        className="page-x tier-wide pt-7 pb-6"
      >
        <p className="text-red-400 text-sm">Failed to load reading lists.</p>
      </main>
    )
  }

  const counts = {
    all: resultAll.success ? resultAll.data.totalCount : 0,
    yours: resultYours.success ? resultYours.data.totalCount : 0,
    following: resultFollowing.success ? resultFollowing.data.totalCount : 0,
    liked: resultLiked.success ? resultLiked.data.totalCount : 0,
  }

  const { rows, totalCount } = active.data
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Ghost context derivation.
  // V1 deferrals (mirror Hives Hub T8 precedent): `allListsAreUntagged`,
  // `hasHighFollowerList`, `trendingFromFriend`, `smallestOwnedListId`,
  // `highestFollowerListId` hardcoded null/false. Wiring them needs viewer-
  // wide queries (taste-vector / friend-graph joins) that are out-of-scope
  // for the integration task. Follow-up commit will widen ghost-context
  // derivation. Variants gated on these flags will silently skip.
  const ghostContext = {
    tab,
    ownCount: counts.yours,
    followingCount: counts.following,
    likedListEmpty: counts.liked === 0,
    allListsAreUntagged: false,
    hasHighFollowerList: false,
    trendingFromFriend: null,
  }

  const sortForUrl = sort !== 'recent' ? sort : ''

  return (
    <main
      className="page-x tier-wide pt-7 pb-6"
    >
      <div className="grid items-start xl:grid-cols-[minmax(0,1fr)_300px] grid-cols-1 gap-8">
        <div className="min-w-0">
          <BackToCommunity href={`/${locale}/community`} />
          <header className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1
                className="text-[32px] font-bold leading-tight"
                style={{
                  color: 'var(--canvas-dark-ink-strong)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Your reading lists
              </h1>
              <p
                className="text-[13px] mt-1.5"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Curate, follow, and share collections of books you love.
              </p>
            </div>
            <CreateListButton locale={locale} />
          </header>

          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <ListsTabStrip
              activeTab={tab}
              counts={counts}
              locale={locale}
              sort={sortForUrl}
            />
            <ListsSortDropdown selected={sort as CommunityListsSort} />
          </div>

          <ListsTagFilterStrip
            tags={topTags}
            activeTags={tagFilters}
            locale={locale}
            preserve={{ tab, sort: sortForUrl }}
          />

          {tagFilters.length > 0 && (
            <div className="mb-3">
              <ActiveFilterChips
                chips={tagFilters.map((t) => ({
                  label: `tag: ${t}`,
                  removeHref: (() => {
                    const remaining = tagFilters.filter((x) => x !== t)
                    const sp = new URLSearchParams()
                    if (tab && tab !== 'all') sp.set('tab', tab)
                    if (sortForUrl) sp.set('sort', sortForUrl)
                    if (remaining.length > 0)
                      sp.set('tags', remaining.join(','))
                    const qs = sp.toString()
                    return `/${locale}/community/reading-lists${qs ? `?${qs}` : ''}`
                  })(),
                }))}
              />
            </div>
          )}

          <ListsGrid
            tagFilters={tagFilters}
            rows={rows.map((r) => ({
              ...r,
              coverPreviews: r.coverPreviews
                .filter((c): c is { bookId: string; coverUrl: string | null } =>
                  c.bookId !== null,
                ),
            }))}
            ghostContext={ghostContext}
            locale={locale}
            trendingHint={null}
            smallestOwnedListId={null}
            highestFollowerListId={null}
          />

          {totalCount > PAGE_SIZE ? (
            <ListsHubPagination
              currentPage={page}
              totalPages={totalPages}
              locale={locale}
              tab={tab}
              sort={sortForUrl}
              tags={tagFilters}
            />
          ) : null}
        </div>
        <ListsRightRail locale={locale} viewerId={viewerId} />
      </div>
    </main>
  )
}
