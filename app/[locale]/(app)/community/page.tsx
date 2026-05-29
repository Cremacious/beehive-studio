import { getSuggestedWritersAction, getMyActiveSparksAction } from '@/lib/actions/community.actions'
import { getHiveActivityFeedAction } from '@/lib/actions/hive-activity.actions'
import { getUserHivesView } from '@/lib/actions/hive.actions'
import { ActivityFeed } from './_components/activity-feed'
import { MyHivesPanel } from './_components/sidebar/my-hives-panel'
import { SuggestedWritersPanel } from './_components/sidebar/suggested-writers-panel'
import { ActiveSparksPanel } from './_components/sidebar/active-sparks-panel'

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  const [feedResult, writersResult, sparksResult, hivesResult] = await Promise.all([
    getHiveActivityFeedAction({ limit: 30 }),
    getSuggestedWritersAction({ excludeFollowing: true, limit: 8 }),
    getMyActiveSparksAction(),
    getUserHivesView(),
  ])

  const feedItems = feedResult.success ? feedResult.data.items : []
  const feedCursor = feedResult.success ? feedResult.data.nextCursor : null
  const suggestedWriters = writersResult.success ? writersResult.data : []
  const activeSparks = sparksResult.success ? sparksResult.data : []
  const myHives = hivesResult.success ? hivesResult.data : []

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6 flex flex-col lg:flex-row gap-6">
      <main className="flex-1 flex flex-col gap-4 min-w-0">
        <ActivityFeed initialItems={feedItems} initialNextCursor={feedCursor} />
      </main>

      <aside className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
        <MyHivesPanel locale={locale} hives={myHives} />
        <SuggestedWritersPanel locale={locale} writers={suggestedWriters.slice(0, 3)} />
        <ActiveSparksPanel locale={locale} entries={activeSparks} />
      </aside>
    </div>
  )
}
