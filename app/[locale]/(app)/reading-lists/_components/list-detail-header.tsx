import Link from 'next/link'
import type {
  ListSummary,
  ListOwner,
} from '@/lib/actions/reading-lists.actions'
import { FollowListButton } from './follow-list-button'

type Props = {
  list: ListSummary
  owner: ListOwner
  isFollowing: boolean
  isOwner: boolean
  locale: string
}

/**
 * T10 stub. T13 will enrich with: visibility pill, tag chips, ⋯ kebab
 * (Edit metadata / Delete for owner), Liked-list `🤍 Auto` pill variant.
 */
export function ListDetailHeader({
  list,
  owner,
  isFollowing,
  isOwner,
  locale,
}: Props) {
  return (
    <header className="mb-6">
      <h1
        className="text-3xl font-bold text-[var(--brand)] mb-2"
        style={{ fontFamily: 'var(--font-comfortaa)' }}
      >
        {list.title}
      </h1>
      {list.description && (
        <p className="text-sm text-[var(--canvas-dark-ink)] mb-3 max-w-prose">
          {list.description}
        </p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[var(--canvas-dark-ink-muted)]">
          {owner?.username && (
            <Link
              href={`/${locale}/u/${owner.username}`}
              className="hover:text-[var(--brand)] transition-colors"
            >
              by @{owner.username}
            </Link>
          )}
          <span>·</span>
          <span>{list.bookCount ?? 0} books</span>
          <span>·</span>
          <span>{list.followerCount ?? 0} followers</span>
        </div>
        {!isOwner && (
          <FollowListButton listId={list.id} initialFollowing={isFollowing} />
        )}
      </div>
    </header>
  )
}
