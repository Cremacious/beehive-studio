import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { parseRadio, parseIntParam } from '@/lib/discover/url-state'
import { getCommunityClubsAction } from '@/lib/actions/clubs-hub.actions'
import { getTrendingClubsForRailAction } from '@/lib/actions/clubs-rail.actions'
import { ClubsTabStrip } from './_components/clubs-tab-strip'
import { ClubsSortDropdown } from './_components/clubs-sort-dropdown'
import { ClubsHubPagination } from './_components/clubs-hub-pagination'
import { ClubsRightRail } from './_components/clubs-right-rail'
import { ClubsGrid } from './_components/clubs-grid'
import { CreateClubButton } from './_components/create-club-button'

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

export default async function ClubsHubPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams

  // Legacy URL: /clubs?filter=mine → /clubs?tab=yours
  if (pickRaw(sp, 'filter') === 'mine') {
    redirect(`/${locale}/clubs?tab=yours`)
  }

  // Auth gate — clubs hub is personal by definition.
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/clubs`)}`)
  }

  const tab = parseRadio(
    pickRaw(sp, 'tab'),
    ['all', 'yours', 'member', 'suggested'] as const,
    'all',
  )
  const sort = parseRadio(
    pickRaw(sp, 'sort'),
    ['active', 'newest', 'a-z', 'members'] as const,
    'active',
  )
  const page = Math.max(1, parseIntParam(pickRaw(sp, 'page'), 1))

  const [result, trendingR] = await Promise.all([
    getCommunityClubsAction({ tab, sort, page }),
    getTrendingClubsForRailAction({ limit: 1 }),
  ])

  if (!result.success) {
    return (
      <main
        className="mx-auto w-full px-6 pt-7 pb-6"
        style={{ maxWidth: '1680px' }}
      >
        <p className="text-red-400 text-sm">Failed to load clubs.</p>
      </main>
    )
  }
  const { clubs, totalCount, bucketCounts } = result.data
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Ghost context derived from the current page slice. v1 limitation:
  // `hasSoloClub` and `hasNoCurrentBook` only reflect clubs on this page.
  // `hasEmptyQueue` + `hasRecentDiscussion` are hardcoded `false` for v1
  // (the set-current-book / start-discussion ghosts may surface even when
  // those conditions are technically met elsewhere). Follow-up: widen via
  // separate viewer-wide queries.
  const yoursOnPage = clubs.filter((c) => c.source === 'yours')
  const ghostContext = {
    hasSoloClub: yoursOnPage.some((c) => c.memberCount === 1),
    hasNoCurrentBook: yoursOnPage.some((c) => c.currentBookId === null),
    hasEmptyQueue: false,
    hasRecentDiscussion: false,
  }
  const smallestOwnedClubId = yoursOnPage.length
    ? yoursOnPage.reduce((min, c) =>
        c.memberCount < min.memberCount ? c : min,
      ).id
    : null
  const anyOwnedClubId = yoursOnPage[0]?.id ?? null
  const trendingClub =
    trendingR.success && trendingR.data[0]
      ? { id: trendingR.data[0].id, name: trendingR.data[0].name }
      : null

  return (
    <main
      className="mx-auto w-full px-6 pt-7 pb-6"
      style={{ maxWidth: '1680px' }}
    >
      <div className="grid items-start xl:grid-cols-[minmax(0,1fr)_300px] grid-cols-1 gap-8">
        <div className="min-w-0">
          <header className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1
                className="text-[32px] font-bold leading-tight"
                style={{
                  color: 'var(--canvas-dark-ink-strong)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Clubs
              </h1>
              <p
                className="text-[13px] mt-1.5"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Read together. Discuss, schedule, and keep up with the current book.
              </p>
            </div>
            <CreateClubButton locale={locale} />
          </header>

          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <ClubsTabStrip
              locale={locale}
              current={tab}
              counts={bucketCounts}
              baseParams={{
                sort: sort !== 'active' ? sort : undefined,
              }}
            />
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Sort
              </span>
              <ClubsSortDropdown selected={sort} />
            </div>
          </div>

          <ClubsGrid
            clubs={clubs}
            tab={tab}
            locale={locale}
            bucketCounts={bucketCounts}
            ghostContext={ghostContext}
            trendingClub={trendingClub}
            smallestOwnedClubId={smallestOwnedClubId}
            anyOwnedClubId={anyOwnedClubId}
          />

          {totalCount > PAGE_SIZE ? (
            <ClubsHubPagination
              locale={locale}
              page={page}
              totalPages={totalPages}
              baseParams={{
                tab: tab !== 'all' ? tab : undefined,
                sort: sort !== 'active' ? sort : undefined,
              }}
            />
          ) : null}
        </div>
        <ClubsRightRail locale={locale} />
      </div>
    </main>
  )
}
