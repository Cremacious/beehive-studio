import type { BookClubMemberRole } from '@/db/schema/social'

type Props = {
  clubId: string
  viewerRole: BookClubMemberRole | null
  locale: string
}

/**
 * T11 stub. T14 will enrich with: discussion thread list via
 * listClubDiscussionsAction, pinned-first sort, new-discussion CTA gated
 * on membership, reply counts, like/pin affordances.
 */
export function ClubDiscussionsPanel({ clubId, viewerRole, locale }: Props) {
  void clubId
  void viewerRole
  void locale
  return (
    <div className="text-[var(--canvas-dark-ink-muted)] italic">
      Discussions coming soon (T14).
    </div>
  )
}
