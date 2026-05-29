import { getCommunityFeedAction, getSuggestedWritersAction, getMyActiveSparksAction } from '@/lib/actions/community.actions'
// TODO: use getUserHivesView post-H1-T7
// import { getMyHivesAction } from '@/lib/actions/hive.actions'
import { CommunityPageShell } from './_components/community-page-shell'

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  const [feedResult, writersResult, sparksResult] = await Promise.all([
    getCommunityFeedAction({ limit: 20 }),
    getSuggestedWritersAction({ excludeFollowing: true, limit: 8 }),
    // TODO: use getUserHivesView post-H1-T7
    // getMyHivesAction(),
    getMyActiveSparksAction(),
  ])

  const feedItems = feedResult.success ? feedResult.data.items : []
  const feedCursor = feedResult.success ? feedResult.data.nextCursor : null
  const hasAnyFollows = feedResult.success ? feedResult.data.hasAnyFollows : false
  const suggestedWriters = writersResult.success ? writersResult.data : []
  // TODO: use getUserHivesView post-H1-T7
  const myHives: never[] = []
  const activeSparks = sparksResult.success ? sparksResult.data : []

  return (
    <CommunityPageShell
      locale={locale}
      feedItems={feedItems}
      feedCursor={feedCursor}
      hasAnyFollows={hasAnyFollows}
      suggestedWriters={suggestedWriters}
      myHives={myHives}
      activeSparks={activeSparks}
    />
  )
}
