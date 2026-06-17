import {
  ClubCard as SharedClubCard,
  type ClubCardData,
} from '@/components/club/club-card'
import type { ClubSummary } from '@/lib/actions/book-clubs.actions'

export { SharedClubCard as ClubHubCard }
export type { ClubCardData }

type Props = {
  club: ClubSummary
  locale: string
}

/**
 * Legacy adapter: maps the wider `ClubSummary` shape to `ClubCardData` for
 * existing consumers (the legacy `/clubs` page + profile page Clubs section).
 * Once the `/clubs` page is rewritten (T8) to consume `CommunityClubRow`
 * directly, this adapter only serves the profile page consumer.
 */
export function ClubCard({ club, locale }: Props) {
  const viewerRoleRaw = club.viewerMembership?.role ?? null
  // ClubSummary uses 'CONTRIBUTOR'-style roles via BookClubMemberRole; the
  // V2 card only recognizes OWNER / MODERATOR / MEMBER. Collapse anything
  // unknown into MEMBER.
  const viewerRole: ClubCardData['viewerRole'] =
    viewerRoleRaw === 'OWNER' || viewerRoleRaw === 'MODERATOR'
      ? viewerRoleRaw
      : viewerRoleRaw
        ? 'MEMBER'
        : null

  const source: ClubCardData['source'] =
    viewerRole === 'OWNER' ? 'yours' : viewerRole ? 'member' : 'member'

  const data: ClubCardData = {
    id: club.id,
    name: club.name,
    description: club.description,
    coverImageUrl: club.coverImageUrl,
    source,
    viewerRole,
    openJoin: club.openJoin,
    memberCount: club.memberCount,
    memberPreviews: club.memberPreviews ?? [],
    lastActiveAt: club.lastActivityAt,
    currentBookTitle: club.currentBook?.title ?? null,
    suggestionReason: null,
  }

  return <SharedClubCard club={data} locale={locale} />
}
