import { getCommunityFeedAction, getSuggestedWritersAction, getMyActiveSparksAction } from '@/lib/actions/community.actions'
import { getMyHivesAction } from '@/lib/actions/hive.actions'
import { CommunityPageShell } from './_components/community-page-shell'

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  const [feedResult, writersResult, hivesResult, sparksResult] = await Promise.all([
    getCommunityFeedAction({ limit: 20 }),
    getSuggestedWritersAction({ excludeFollowing: true, limit: 8 }),
    getMyHivesAction(),
    getMyActiveSparksAction(),
  ])

  const feedItems = feedResult.success ? feedResult.data.items : []
  const feedCursor = feedResult.success ? feedResult.data.nextCursor : null
  const hasAnyFollows = feedResult.success ? feedResult.data.hasAnyFollows : false
  const suggestedWriters = writersResult.success ? writersResult.data : []
  const myHives = hivesResult.success ? hivesResult.data : []
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
