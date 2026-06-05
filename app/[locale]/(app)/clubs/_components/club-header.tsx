import Link from 'next/link'
import type { ClubSummary, ClubOwner } from '@/lib/actions/book-clubs.actions'
import type { BookClubMemberRole } from '@/db/schema/social'

type Props = {
  club: ClubSummary
  owner: ClubOwner
  viewerRole: BookClubMemberRole | null
  viewerMembership: { role: BookClubMemberRole | null }
  memberCount: number
  isOwner: boolean
  locale: string
}

/**
 * T11 stub. T13 will enrich with: visibility pill, owner card with avatar,
 * dynamic primary CTA (Join / Request to join / Pending / Leave / Invite),
 * ⋯ kebab for OWNER (Settings / Delete).
 */
export function ClubHeader({
  club,
  owner,
  viewerRole,
  viewerMembership,
  memberCount,
  isOwner,
  locale,
}: Props) {
  void viewerRole
  void viewerMembership
  void isOwner
  return (
    <header className="mb-6">
      <h1
        className="text-3xl font-bold text-[var(--brand)] mb-2"
        style={{ fontFamily: 'var(--font-comfortaa)' }}
      >
        {club.name}
      </h1>
      {club.description && (
        <p className="text-sm text-[var(--canvas-dark-ink)] mb-3 max-w-prose">
          {club.description}
        </p>
      )}
      <div className="text-xs text-[var(--canvas-dark-ink-muted)]">
        {owner.username && (
          <Link
            href={`/${locale}/u/${owner.username}`}
            className="hover:text-[var(--brand)] transition-colors"
          >
            by @{owner.username}
          </Link>
        )}
        <span className="mx-2">·</span>
        <span>{memberCount} members</span>
      </div>
    </header>
  )
}
