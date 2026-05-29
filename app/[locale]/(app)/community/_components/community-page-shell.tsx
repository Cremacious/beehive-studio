import { SuggestedWritersStrip } from './suggested-writers-strip'
import { FeedList } from './feed-list'
import { MyHivesPanel } from './sidebar/my-hives-panel'
import { SuggestedWritersPanel } from './sidebar/suggested-writers-panel'
import { ActiveSparksPanel } from './sidebar/active-sparks-panel'
import type { FeedItem, SuggestedWriter, ActiveSparkEntry } from '@/lib/types/community'
// TODO: replace with getUserHivesView projection post-H1-T7
type MyHiveSummary = { id: string; name: string; memberCount: number; isPublic: boolean }

export function CommunityPageShell({
  locale,
  feedItems,
  feedCursor,
  hasAnyFollows,
  suggestedWriters,
  myHives,
  activeSparks,
}: {
  locale: string
  feedItems: FeedItem[]
  feedCursor: string | null
  hasAnyFollows: boolean
  suggestedWriters: SuggestedWriter[]
  myHives: MyHiveSummary[]
  activeSparks: ActiveSparkEntry[]
}) {
  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6 flex flex-col lg:flex-row gap-6">
      <main className="flex-1 flex flex-col gap-4 min-w-0">
        <SuggestedWritersStrip locale={locale} writers={suggestedWriters} />
        <FeedList
          locale={locale}
          initialItems={feedItems}
          initialNextCursor={feedCursor}
          hasAnyFollows={hasAnyFollows}
        />
      </main>

      <aside className="w-full lg:w-72 flex flex-col gap-4 shrink-0">
        <MyHivesPanel locale={locale} hives={myHives} />
        <SuggestedWritersPanel locale={locale} writers={suggestedWriters.slice(0, 3)} />
        <ActiveSparksPanel locale={locale} entries={activeSparks} />
      </aside>
    </div>
  )
}
