import Link from 'next/link'
import type { ClubSummary } from '@/lib/actions/book-clubs.actions'

type Props = {
  club: ClubSummary
  locale: string
}

/**
 * T10 stub. T13/T18 will enrich with: visibility pill, owner avatar/handle,
 * tag chips first 3 + "+N more", current-book pill, open-join vs private
 * indicator, member-count chip, hover lift.
 */
export function ClubCard({ club, locale }: Props) {
  return (
    <Link
      href={`/${locale}/clubs/${club.id}`}
      className="block p-4 rounded-[var(--r-card)] border border-[var(--br-card)] hover:border-[var(--canvas-dark-ink-muted)] transition-colors"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
      }}
    >
      <h3
        className="font-bold text-[var(--canvas-dark-ink-strong)] mb-1"
        style={{ fontFamily: 'var(--font-comfortaa)' }}
      >
        {club.name}
      </h3>
      {club.description && (
        <p className="text-xs text-[var(--canvas-dark-ink-muted)] line-clamp-2 mb-2">
          {club.description}
        </p>
      )}
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
        {club.memberCount} members
        {club.currentBook ? ` · Reading "${club.currentBook.title}"` : ''}
      </p>
    </Link>
  )
}
