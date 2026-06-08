import Link from 'next/link'
import type { ListSummary } from '@/lib/actions/reading-lists.actions'
import { VisibilityPill } from '@/app/[locale]/(public)/discover/_components/visibility-pill'

type Props = {
  list: ListSummary
  locale: string
  isFollowing?: boolean
  viewerIsOwner?: boolean
}

/**
 * T13 enriched: visibility pill (non-PUBLIC), Liked-variant 🤍 Auto pill,
 * owner row (hidden for owner-viewers), tag chips (first 3 + "+N more"),
 * meta row.
 */
export function ListCard({ list, locale, viewerIsOwner }: Props) {
  const isLiked = list.kind === 'LIKED'
  const tags = list.tags ?? []
  const visibleTags = tags.slice(0, 3)
  const extraTagCount = tags.length - visibleTags.length
  const owner = list.owner
  const showOwner = !viewerIsOwner && !!owner?.username

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
      <div className="flex items-start gap-2 mb-1">
        <h3
          className="font-bold text-[var(--canvas-dark-ink-strong)] flex-1 min-w-0 truncate"
          style={{ fontFamily: 'var(--font-comfortaa)' }}
        >
          {list.title}
        </h3>
        {isLiked ? (
          <span
            className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[var(--br-card)] text-[var(--canvas-dark-ink-muted)]"
            title="Auto-managed Liked list"
          >
            🤍 Auto
          </span>
        ) : list.visibility !== 'PUBLIC' ? (
          <span className="shrink-0">
            <VisibilityPill visibility={list.visibility} />
          </span>
        ) : null}
      </div>

      {list.description && (
        <p className="text-xs text-[var(--canvas-dark-ink-muted)] line-clamp-2 mb-2">
          {list.description}
        </p>
      )}

      {showOwner && (
        <div className="flex items-center gap-2 mb-2">
          {owner.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={owner.avatarUrl}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <div
              className="h-6 w-6 rounded-full"
              style={{
                background:
                  'linear-gradient(135deg, var(--canvas-dark-300), var(--canvas-dark-200))',
              }}
            />
          )}
          <span className="text-xs text-[var(--canvas-dark-ink-muted)]">
            @{owner.username}
          </span>
        </div>
      )}

      {visibleTags.length > 0 && (
        <ul className="flex flex-wrap gap-1 mb-2">
          {visibleTags.map((tag) => (
            <li
              key={tag}
              className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[var(--br-card)] text-[var(--canvas-dark-ink-muted)]"
            >
              {tag}
            </li>
          ))}
          {extraTagCount > 0 && (
            <li className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border border-[var(--br-card)] text-[var(--canvas-dark-ink-muted)]">
              +{extraTagCount} more
            </li>
          )}
        </ul>
      )}

      <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)]">
        {list.bookCount ?? 0} books · {list.followerCount ?? 0} followers
      </p>
    </Link>
  )
}
