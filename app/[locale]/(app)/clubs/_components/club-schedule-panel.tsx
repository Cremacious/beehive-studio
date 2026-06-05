import type { ClubCurrentBook } from '@/lib/actions/book-clubs.actions'
import type { BookClubMemberRole } from '@/db/schema/social'

type Props = {
  clubId: string
  viewerRole: BookClubMemberRole | null
  currentBook: ClubCurrentBook | null
  locale: string
}

/**
 * T11 stub. T17 will enrich with: schedule milestones via
 * getClubScheduleAction, per-checkpoint progress, add/edit/delete gated on
 * MOD/OWNER, current-book context header.
 */
export function ClubSchedulePanel({ clubId, viewerRole, currentBook, locale }: Props) {
  void clubId
  void viewerRole
  void currentBook
  void locale
  return (
    <div className="text-[var(--canvas-dark-ink-muted)] italic">
      Schedule coming soon (T17).
    </div>
  )
}
