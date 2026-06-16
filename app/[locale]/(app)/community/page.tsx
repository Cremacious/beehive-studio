import { requireAuth } from '@/lib/require-auth'
import { getCommunityFeedAction } from '@/lib/actions/community.actions'
import { getCommunityHubHighlightsAction } from '@/lib/actions/community-hub.actions'
import { EMPTY_HIGHLIGHTS } from '@/lib/actions/community-hub.shared'
import { ActivityFeed } from './_components/activity-feed'
import { HighlightsRail } from './_components/highlights-rail'

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  await requireAuth()

  const [feedResult, highlightsResult] = await Promise.all([
    getCommunityFeedAction({ limit: 20 }),
    getCommunityHubHighlightsAction(),
  ])

  const feedRows = feedResult.success ? feedResult.data.rows : []
  const feedCursor = feedResult.success ? feedResult.data.nextCursor : null
  const highlights = highlightsResult.success
    ? highlightsResult.data
    : EMPTY_HIGHLIGHTS

  return (
    <div className="max-w-[1680px] mx-auto px-4 py-6">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 min-h-[calc(100vh-100px)]">
        <main className="flex flex-col min-h-[calc(100vh-100px)]">
          <ActivityFeed
            initialRows={feedRows}
            initialCursor={feedCursor}
            locale={locale}
          />
        </main>
        <aside className="xl:sticky xl:top-20 xl:h-[calc(100vh-100px)] flex flex-col">
          <HighlightsRail highlights={highlights} locale={locale} />
        </aside>
      </div>
    </div>
  )
}
