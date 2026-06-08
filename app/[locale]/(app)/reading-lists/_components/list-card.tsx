import Link from 'next/link'
import { Globe, Users, Lock, Heart, BookMarked } from 'lucide-react'
import type { ListSummary } from '@/lib/actions/reading-lists.actions'

type Props = {
  list: ListSummary
  locale: string
  isFollowing?: boolean
  viewerIsOwner?: boolean
}

type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

const VIS_META: Record<
  Visibility,
  { label: string; pillClass: string; Icon: typeof Globe; coverVar: string }
> = {
  PUBLIC: {
    label: 'Public',
    pillClass: 'pill vis-public',
    Icon: Globe,
    coverVar: 'var(--list-visibility-public)',
  },
  FRIENDS: {
    label: 'Friends',
    pillClass: 'pill vis-friends',
    Icon: Users,
    coverVar: 'var(--list-visibility-friends)',
  },
  PRIVATE: {
    label: 'Private',
    pillClass: 'pill vis-private',
    Icon: Lock,
    coverVar: 'var(--list-visibility-private)',
  },
}

function ownerInitials(owner: ListSummary['owner']): string {
  const source = owner?.displayName || owner?.username || '?'
  const parts = source.replace(/^@/, '').split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/**
 * C5d port: chrome refresh to .ccard structure. Liked variant gets
 * .pill.auto + .pill.vis-private (mutually-exclusive logic preserved:
 * Liked is always PRIVATE per server coercion). Tags first-3 + "+N".
 */
export function ListCard({ list, locale, viewerIsOwner }: Props) {
  const isLiked = list.kind === 'LIKED'
  const tags = list.tags ?? []
  const visibleTags = tags.slice(0, 3)
  const extraTagCount = tags.length - visibleTags.length
  const owner = list.owner
  const showOwner = !viewerIsOwner && !!owner?.username

  const visibility = list.visibility as Visibility
  const visMeta = VIS_META[visibility] ?? VIS_META.PUBLIC
  const coverAccent = isLiked ? 'var(--status-error)' : visMeta.coverVar

  return (
    <Link
      href={`/${locale}/reading-lists/${list.id}`}
      className="ccard"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <div
        className="cc-cover cover-grad"
        style={{ ['--pt' as string]: coverAccent }}
      >
        <div className="cc-pills">
          {isLiked ? (
            <span className="pill auto" title="Auto-managed Liked list">
              <Heart fill="currentColor" stroke="none" />
              Auto
            </span>
          ) : null}
          <span className={visMeta.pillClass}>
            <visMeta.Icon />
            {visMeta.label}
          </span>
        </div>
      </div>

      <div className="cc-body">
        <h3 className="cc-title">{list.title}</h3>

        {list.description ? (
          <p className="cc-desc">{list.description}</p>
        ) : null}

        {visibleTags.length > 0 ? (
          <div className="lc-tags">
            {visibleTags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
            {extraTagCount > 0 ? (
              <span className="tag">+{extraTagCount}</span>
            ) : null}
          </div>
        ) : null}

        <div className="cc-foot">
          {showOwner ? (
            <span className="owner-card">
              {owner.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={owner.avatarUrl}
                  alt=""
                  className="avatar s24"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <span className="avatar s24 brand">{ownerInitials(owner)}</span>
              )}
              <span className="oc-handle">@{owner.username}</span>
            </span>
          ) : null}
          <div className="cc-stats">
            <span className="cc-stat">
              <BookMarked />
              {list.bookCount ?? 0} {(list.bookCount ?? 0) === 1 ? 'book' : 'books'}
            </span>
            {!isLiked ? (
              <span className="cc-stat">
                {list.followerCount ?? 0}{' '}
                {(list.followerCount ?? 0) === 1 ? 'follower' : 'followers'}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  )
}
