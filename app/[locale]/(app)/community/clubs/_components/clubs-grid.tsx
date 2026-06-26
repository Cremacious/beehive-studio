'use client'

import { ClubHubCard } from './club-card'
import { ClubGhostCard } from './club-ghost-card'
import { pickClubGhosts } from './pick-club-ghosts'
import { useDismissedClubGhosts } from './use-dismissed-club-ghosts'
import type { CommunityClubRow } from '@/lib/actions/clubs-hub.actions'

type ClubsTab = 'all' | 'yours' | 'member' | 'suggested'

type Props = {
  clubs: CommunityClubRow[]
  tab: ClubsTab
  locale: string
  bucketCounts: { all: number; yours: number; member: number; suggested: number }
  ghostContext: {
    hasSoloClub: boolean
    hasNoCurrentBook: boolean
    hasEmptyQueue: boolean
    hasRecentDiscussion: boolean
  }
  trendingClub: { id: string; name: string } | null
  smallestOwnedClubId: string | null
  anyOwnedClubId: string | null
}

/**
 * Client interleave of real <ClubHubCard>s + <ClubGhostCard>s.
 * Mirrors <HivesGrid> precedent at app/[locale]/(app)/hives/_components/hives-grid.tsx.
 *
 * The shared <ClubCard> renders at a FIXED 340x360 (T5), so the grid
 * uses minmax(min(100%, 340px), 1fr) auto-fill columns.
 */
export function ClubsGrid({
  clubs,
  tab,
  locale,
  bucketCounts,
  ghostContext,
  trendingClub,
  smallestOwnedClubId,
  anyOwnedClubId,
}: Props) {
  const { dismissed, dismiss } = useDismissedClubGhosts()

  const ghosts = pickClubGhosts({
    tab,
    realCount: clubs.length,
    ownCount: bucketCounts.yours,
    hasSoloClub: ghostContext.hasSoloClub,
    hasNoCurrentBook: ghostContext.hasNoCurrentBook,
    hasEmptyQueue: ghostContext.hasEmptyQueue,
    hasRecentDiscussion: ghostContext.hasRecentDiscussion,
    dismissed: new Set(dismissed),
  })

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
        alignItems: 'stretch',
        justifyItems: 'start',
      }}
    >
      {clubs.map((c) => (
        <ClubHubCard key={c.id} club={c} locale={locale} />
      ))}
      {ghosts.map((variant, i) => (
        <ClubGhostCard
          key={`ghost-${variant}-${i}`}
          variant={variant}
          locale={locale}
          onDismiss={dismiss}
          trendingClub={variant === 'join-suggested' ? trendingClub : null}
          smallestOwnedClubId={
            variant === 'invite-members' ? smallestOwnedClubId : null
          }
          anyOwnedClubId={
            variant === 'set-current-book' ||
            variant === 'add-to-queue' ||
            variant === 'start-discussion'
              ? anyOwnedClubId
              : null
          }
        />
      ))}
    </div>
  )
}
