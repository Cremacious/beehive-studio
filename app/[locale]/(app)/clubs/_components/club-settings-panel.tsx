import type { ClubSummary } from '@/lib/actions/book-clubs.actions'
import type { BookClubMemberRole } from '@/db/schema/social'

type Props = {
  club: ClubSummary
  viewerRole: BookClubMemberRole | null
  locale: string
}

/**
 * T11 stub. T18 will enrich with: name/description/rules edit, visibility
 * picker (PUBLIC/FRIENDS/PRIVATE) + discoverable + openJoin toggles, tag
 * editor, Delete Club danger zone (OWNER only).
 */
export function ClubSettingsPanel({ club, viewerRole, locale }: Props) {
  void club
  void viewerRole
  void locale
  return (
    <div className="text-[var(--canvas-dark-ink-muted)] italic">
      Settings coming soon (T18).
    </div>
  )
}
