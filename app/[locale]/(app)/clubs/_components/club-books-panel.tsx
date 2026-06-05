import type { ClubCurrentBook } from '@/lib/actions/book-clubs.actions'
import type { BookClubMemberRole } from '@/db/schema/social'

type Props = {
  clubId: string
  viewerRole: BookClubMemberRole | null
  currentBook: ClubCurrentBook | null
  locale: string
}

/**
 * T11 stub. T16 will enrich with: club reading queue via getClubBooksAction,
 * dnd-kit reorder for MOD/OWNER, current/up-next/past sections, add-book
 * modal (Beehive search + external), set-current/finish actions.
 */
export function ClubBooksPanel({ clubId, viewerRole, currentBook, locale }: Props) {
  void clubId
  void viewerRole
  void currentBook
  void locale
  return (
    <div className="text-[var(--canvas-dark-ink-muted)] italic">
      Books queue coming soon (T16).
    </div>
  )
}
