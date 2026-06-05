import type { BookClubMemberRole } from '@/db/schema/social'

type Props = {
  clubId: string
  viewerRole: BookClubMemberRole | null
  locale: string
}

/**
 * T11 stub. T13 will enrich with: member roster via listClubMembersAction,
 * role pills, role management for OWNER (promote/demote/remove),
 * pending join requests for closed clubs, invite-link affordance.
 */
export function ClubMembersPanel({ clubId, viewerRole, locale }: Props) {
  void clubId
  void viewerRole
  void locale
  return (
    <div className="text-[var(--canvas-dark-ink-muted)] italic">
      Members coming soon (T13).
    </div>
  )
}
