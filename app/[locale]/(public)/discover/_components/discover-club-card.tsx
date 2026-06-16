import { ClubCard as SharedClubCard, type ClubCardData } from '@/components/club/club-card'
import type { ClubCard } from '@/lib/actions/discover-clubs.actions'

type Variant = 'rail' | 'grid' | 'row'

type Props = {
  club: ClubCard
  locale: string
  /** Kept for back-compat with existing consumers; ignored by the shared card. */
  variant?: Variant
}

/**
 * Thin wrapper over the shared <ClubCard> at components/club/club-card.tsx.
 * Adapts discover-clubs' ClubCard projection. `variant` is accepted but
 * ignored — the shared card has a single canonical 340x360 shape.
 * `showRolePill: false` because the /discover tab is implicitly "suggested".
 */
export function DiscoverClubCard({ club, locale }: Props) {
  const data: ClubCardData = {
    id: club.id,
    name: club.name,
    description: club.description ?? null,
    coverImageUrl: club.coverImageUrl ?? null,
    source: 'suggested',
    viewerRole: null,
    openJoin: club.openJoin ?? true,
    memberCount: club.memberCount,
    memberPreviews: club.memberPreviews ?? [],
    lastActiveAt: club.lastActivityAt ?? null,
    currentBookTitle: club.currentBookTitle ?? null,
    suggestionReason: null,
    showRolePill: false,
  }
  return <SharedClubCard club={data} locale={locale} />
}
