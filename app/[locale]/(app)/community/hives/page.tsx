import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { parseRadio, parseIntParam } from '@/lib/discover/url-state'
import { getCommunityHivesAction } from '@/lib/actions/hives-hub.actions'
import { getTrendingHivesForRailAction } from '@/lib/actions/hives-rail.actions'
import { NewHiveButton } from './_components/new-hive-button'
import { HivesTabStrip } from './_components/hives-tab-strip'
import { HivesSortDropdown } from './_components/hives-sort-dropdown'
import { HivesHubPagination } from './_components/hives-hub-pagination'
import { HivesRightRail } from './_components/hives-right-rail'
import { HivesGrid } from './_components/hives-grid'
import { BackToCommunity } from '@/components/community/back-to-community'

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

export const metadata = { title: 'Hives' }

export default async function HivesHubPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/community/hives`)}`)
  }

  // Backward-compat: ?tab=open → ?tab=suggested (T5 rename).
  const rawTab = pickRaw(sp, 'tab')
  if (rawTab === 'open') {
    redirect(`/${locale}/community/hives?tab=suggested`)
  }

  const tab = parseRadio(
    rawTab,
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
    getCommunityHivesAction({ tab, sort, page }),
    getTrendingHivesForRailAction({ limit: 1 }),
  ])

  if (!result.success) {
    return (
      <main
        className="page-x tier-wide pt-7 pb-6"
      >
        <p className="text-red-400 text-sm">Failed to load hives.</p>
      </main>
    )
  }

  const { hives, totalCount, bucketCounts } = result.data
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // Ghost context derivation — page-slice scoped (v1).
  // `hasSoloHive` only checks the current page's hives. For accuracy across
  // every owned hive a separate query would be needed; flagged as follow-up.
  // `hasActiveWordGoal` + `hasRecentBuzz` are DEFERRED for v1 — hardcoded
  // false so the set-word-goal / set-buzz-up ghosts can surface.
  const ownedHives = hives.filter((h) => h.viewerRole === 'OWNER')
  const hasSoloHive = ownedHives.some((h) => h.memberCount === 1)
  const hasActiveWordGoal = false
  const hasRecentBuzz = false
  const smallestOwnedHiveId =
    ownedHives.length > 0
      ? ownedHives.reduce((min, h) =>
          h.memberCount < min.memberCount ? h : min,
        ).id
      : null
  const anyOwnedHiveId = ownedHives[0]?.id ?? null

  const trendingHive =
    trendingR.success && trendingR.data[0]
      ? { id: trendingR.data[0].id, name: trendingR.data[0].name }
      : null

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
                Hives
              </h1>
              <p
                className="text-[13px] mt-1.5"
                style={{ color: 'var(--canvas-dark-ink-muted)' }}
              >
                Your collaborative writing groups, plus open hives across the
                platform.
              </p>
            </div>
            <NewHiveButton />
          </header>

          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <HivesTabStrip
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
              <HivesSortDropdown selected={sort} />
            </div>
          </div>

          <HivesGrid
            hives={hives}
            tab={tab}
            locale={locale}
            bucketCounts={bucketCounts}
            ghostContext={{
              hasSoloHive,
              hasActiveWordGoal,
              hasRecentBuzz,
            }}
            trendingHive={trendingHive}
            smallestOwnedHiveId={smallestOwnedHiveId}
            anyOwnedHiveId={anyOwnedHiveId}
          />

          {totalCount > PAGE_SIZE ? (
            <HivesHubPagination
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
        <HivesRightRail locale={locale} />
      </div>
    </main>
  )
}
