'use client'

type Props = {
  clubId: string
}

/**
 * Lists outstanding PENDING invites for the club (recipient avatar + @username
 * + Sent {relTime} + Cancel button calling `cancelClubInviteAction`).
 *
 * TODO: `book-clubs.actions.ts` does not yet export a `listClubPendingInvitesAction`.
 * Once that ships, fetch on mount via `useEffect` + `useState`. For now, this
 * renders a Coming soon placeholder so T18 can ship without a server-action gap.
 */
export function PendingInvitesPanel({ clubId }: Props) {
  void clubId
  return (
    <div
      className="rounded-[var(--r-row)] p-4 text-[12px] italic"
      style={{
        background: 'var(--canvas-dark-100)',
        color: 'var(--canvas-dark-ink-muted)',
        boxShadow: 'var(--sh-inset)',
      }}
    >
      Pending invites list — server action pending. Cancel via the recipient&apos;s
      notification flow for now.
    </div>
  )
}
