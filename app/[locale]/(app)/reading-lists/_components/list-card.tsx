import Link from 'next/link'
import type { ListSummary } from '@/lib/actions/reading-lists.actions'

type Props = {
  list: ListSummary
  locale: string
  isFollowing?: boolean
  viewerIsOwner?: boolean
}

/**
 * T9 stub. T13 will enrich with: visibility pill, owner avatar/handle,
 * tag chips, full meta row, Liked variant pill.
 */
export function ListCard({ list, locale }: Props) {
  return (
    <Link
      href={`/${locale}/reading-lists/${list.id}`}
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
        {list.title}
      </h3>
      {list.description && (
        <p className="text-xs text-[var(--canvas-dark-ink-muted)] line-clamp-2 mb-2">
          {list.description}
        </p>
      )}
      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
        {list.bookCount ?? 0} books · {list.followerCount ?? 0} followers
      </p>
    </Link>
  )
}
