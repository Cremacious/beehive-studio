// T6 of hive-card-redesign — thin re-export of the shared <HiveCard>.
// /discover hive surfaces (rail + grid + for-you) now render the canonical
// V2 card. SUGGESTED pill suppressed via showRolePill=false since the
// discoverable-hives tab itself signals join-ability; dashed-green border
// still applies (source='suggested') for visual consistency with the hub.
import { HiveCard, type HiveCardData } from '@/components/hive/hive-card'
import type { HiveCard as DiscoverHiveCardRow } from '@/lib/actions/discover-hives.actions'

type Props = {
  hive: DiscoverHiveCardRow
  locale: string
}

export function RailHiveCard({ hive, locale }: Props) {
  const data: HiveCardData = {
    id: hive.id,
    name: hive.name,
    bookTitle: hive.bookTitle ?? null,
    source: 'suggested',
    viewerRole: null,
    memberCount: hive.memberCount,
    memberPreviews: hive.memberPreviews,
    lastActiveAt: hive.lastActivityAt,
    suggestionReason: null,
    wordGoalPct: null,
    showRolePill: false,
  }
  return (
    <div className="w-[280px] shrink-0">
      <HiveCard hive={data} locale={locale} />
    </div>
  )
}
