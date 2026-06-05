'use client'

import type { BookClubMemberRole } from '@/db/schema/social'

type Props = {
  clubId: string
  viewerRole: BookClubMemberRole | null
}

/**
 * Lists PENDING join requests for the club (requester avatar + @username +
 * Requested {relTime} + Approve/Reject buttons calling `respondToJoinRequestAction`).
 *
 * TODO: `book-clubs.actions.ts` does not yet export a `listClubJoinRequestsAction`.
 * Once that ships, fetch on mount via `useEffect` + `useState`. For now this
 * renders a Coming soon placeholder so T18 can ship without a server-action gap.
 */
export function JoinRequestsPanel({ clubId, viewerRole }: Props) {
  void clubId
  void viewerRole
  return (
    <div
      className="rounded-[var(--r-row)] p-4 text-[12px] italic"
      style={{
        background: 'var(--canvas-dark-100)',
        color: 'var(--canvas-dark-ink-muted)',
        boxShadow: 'var(--sh-inset)',
      }}
    >
      Join requests list — server action pending. Requesters will appear here
      once `listClubJoinRequestsAction` lands.
    </div>
  )
}
