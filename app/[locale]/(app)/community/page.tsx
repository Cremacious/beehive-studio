import { getSuggestedWritersAction, getMyActiveSparksAction } from '@/lib/actions/community.actions'
// TODO H1-T14: replace with getHiveActivityFeedAction + getUserHivesView
import { CommunityPageShell } from './_components/community-page-shell'
import type { FeedItem } from '@/lib/types/community'

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  const [writersResult, sparksResult] = await Promise.all([
    getSuggestedWritersAction({ excludeFollowing: true, limit: 8 }),
    getMyActiveSparksAction(),
  ])

  // TODO H1-T14: replace with getHiveActivityFeedAction
  const feedItems: FeedItem[] = []
  const feedCursor: string | null = null
  const hasAnyFollows = false
  const suggestedWriters = writersResult.success ? writersResult.data : []
  // TODO H1-T14: replace with getUserHivesView projection
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
