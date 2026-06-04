import { requireAuth } from '@/lib/require-auth'
import {
  getCommunityFeedAction,
  getMyActiveSparksAction,
} from '@/lib/actions/community.actions'
import {
  listPendingFriendRequestsAction,
  getFriendCountAction,
} from '@/lib/actions/friendships.actions'
import { getUserHivesView } from '@/lib/actions/hive.actions'
import { SectionRail } from './_components/section-rail'
import { ActivityFeed } from './_components/activity-feed'
import { RequestsCard } from './_components/requests-card'
import { ActiveSparksPanel } from './_components/sidebar/active-sparks-panel'
import { MyHivesPanel } from './_components/sidebar/my-hives-panel'

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const viewerId = await requireAuth()

  const [feedResult, requestsResult, sparksResult, friendsCountResult, hivesResult] =
    await Promise.all([
      getCommunityFeedAction({ limit: 20 }),
      listPendingFriendRequestsAction(),
      getMyActiveSparksAction(),
      getFriendCountAction(viewerId),
      getUserHivesView(),
    ])

  const feedRows = feedResult.success ? feedResult.data.rows : []
  const feedCursor = feedResult.success ? feedResult.data.nextCursor : null
  const incomingRequests = requestsResult.success ? requestsResult.data.incoming : []
  const activeSparks = sparksResult.success ? sparksResult.data : []
  const friendsCount = friendsCountResult.success ? friendsCountResult.data : 0
  const hives = hivesResult.success ? hivesResult.data : []

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 lg:px-6">
      <header className="flex flex-col gap-1">
        <h1
          style={{ color: 'var(--brand)' }}
          className="font-comfortaa text-3xl font-bold"
        >
          Community
        </h1>
        <p
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
          className="text-sm"
        >
          What your friends, follows, and hives are up to.
        </p>
      </header>

      <SectionRail
        locale={locale}
        friendsCount={friendsCount}
        hivesCount={hives.length}
        sparksCount={activeSparks.length}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <main className="flex min-w-0 flex-col gap-3">
          <ActivityFeed
            initialRows={feedRows}
            initialCursor={feedCursor}
            locale={locale}
          />
        </main>

        <aside className="flex w-full shrink-0 flex-col gap-4">
          <RequestsCard
            locale={locale}
            count={incomingRequests.length}
            samples={incomingRequests.map((r) => ({
              userId: r.userId,
              username: r.username,
              avatarUrl: r.avatarUrl,
            }))}
          />
          <MyHivesPanel locale={locale} hives={hives} />
          <ActiveSparksPanel locale={locale} entries={activeSparks} />
        </aside>
      </div>
    </div>
  )
}
