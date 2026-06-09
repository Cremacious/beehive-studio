import { requireAuth } from '@/lib/require-auth'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import {
  getCommunityFeedAction,
  getMyActiveSparksAction,
} from '@/lib/actions/community.actions'
import {
  listPendingFriendRequestsAction,
  getFriendCountAction,
} from '@/lib/actions/friendships.actions'
import { getUserHivesView } from '@/lib/actions/hive.actions'
import { getMyClubsCountAction } from '@/lib/actions/book-clubs.actions'
import { getListsAction } from '@/lib/actions/reading-lists.actions'
import { PageHead } from '@/components/community/page-head'
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

  const [
    feedResult,
    requestsResult,
    sparksResult,
    friendsCountResult,
    hivesResult,
    clubsCountResult,
    listsResult,
    viewerProfile,
  ] = await Promise.all([
    getCommunityFeedAction({ limit: 20 }),
    listPendingFriendRequestsAction(),
    getMyActiveSparksAction(),
    getFriendCountAction(viewerId),
    getUserHivesView(),
    getMyClubsCountAction(),
    getListsAction({ filter: 'mine', limit: 1 }),
    db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, viewerId),
      columns: { username: true, displayName: true },
    }),
  ])

  const feedRows = feedResult.success ? feedResult.data.rows : []
  const feedCursor = feedResult.success ? feedResult.data.nextCursor : null
  const incomingRequests = requestsResult.success ? requestsResult.data.incoming : []
  const activeSparks = sparksResult.success ? sparksResult.data : []
  const friendsCount = friendsCountResult.success ? friendsCountResult.data : 0
  const hives = hivesResult.success ? hivesResult.data : []
  const clubsCount = clubsCountResult.success ? clubsCountResult.data.count : 0
  // listsResult is paginated; the rows array can be empty even when the user
  // has lists, since we requested limit:1. We use this just for a presence
  // signal — the count badge uses rows.length which is at most 1. A dedicated
  // getMyListsCountAction would be more accurate (future follow-up).
  const listsCount = listsResult.success ? listsResult.data.rows.length : 0

  const greetingName =
    viewerProfile?.displayName ??
    (viewerProfile?.username ? `@${viewerProfile.username}` : 'there')

  return (
    <main className="cm-wrap w-5xl">
      <PageHead title={`Hey ${greetingName} — here's what's buzzing`} />

      <SectionRail
        locale={locale}
        friendsCount={friendsCount}
        hivesCount={hives.length}
        sparksCount={activeSparks.length}
        listsCount={listsCount}
        clubsCount={clubsCount}
      />

      <div className="grid gap-6 lg:[grid-template-columns:1fr_280px]">
        <div className="min-w-0">
          <ActivityFeed
            initialRows={feedRows}
            initialCursor={feedCursor}
            locale={locale}
          />
        </div>

        <aside className="space-y-4">
          <RequestsCard
            locale={locale}
            count={incomingRequests.length}
            samples={incomingRequests.map((r) => ({
              friendshipId: r.friendshipId,
              userId: r.userId,
              username: r.username,
              displayName: r.displayName,
              avatarUrl: r.avatarUrl,
            }))}
          />
          <MyHivesPanel locale={locale} hives={hives} />
          <ActiveSparksPanel locale={locale} entries={activeSparks} />
        </aside>
      </div>
    </main>
  )
}
