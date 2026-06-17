import { ClubCard as SharedClubCard, type ClubCardData } from '@/components/club/club-card'
import type { ClubCard } from '@/lib/actions/discover-clubs.actions'

type Props = {
  club: ClubCard
  locale: string
}

/**
 * Thin wrapper over the shared <ClubCard> at components/club/club-card.tsx.
 * Maps discover-clubs' ClubCard projection to the shared ClubCardData shape.
 * `showRolePill: false` because the /discover tab itself signals
 * discoverability — the SUGGESTED pill would be redundant.
 */
export function RailClubCard({ club, locale }: Props) {
  const data: ClubCardData = {
    id: club.id,
    name: club.name,
    description: club.description ?? null,
    coverImageUrl: club.coverImageUrl ?? null,
    source: 'member',
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
