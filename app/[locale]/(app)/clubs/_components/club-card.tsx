import Link from 'next/link'
import { Globe, Users, Lock } from 'lucide-react'
import type { ClubSummary } from '@/lib/actions/book-clubs.actions'

type Props = {
  club: ClubSummary
  locale: string
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

function ownerInitials(owner: ClubSummary['owner']): string {
  const source = owner?.displayName || owner?.username || '?'
  const parts = source.replace(/^@/, '').split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/**
 * C5d port: chrome refresh to .ccard structure. Pills: visibility +
 * open-join (when openJoin). Tag chips first-3 + "+N more". Owner card +
 * current-book line + member count.
 */
export function ClubCard({ club, locale }: Props) {
  const tags = club.tags ?? []
  const visibleTags = tags.slice(0, 3)
  const extraTagCount = tags.length - visibleTags.length
  const owner = club.owner

  const visibility = club.visibility as Visibility
  const visMeta = VIS_META[visibility] ?? VIS_META.PUBLIC
  const coverAccent = visMeta.coverVar

  return (
    <Link
      href={`/${locale}/clubs/${club.id}`}
      className="ccard"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <div
        className="cc-cover cover-grad"
        style={{ ['--pt' as string]: coverAccent }}
      >
        <div className="cc-pills">
          <span className={visMeta.pillClass}>
            <visMeta.Icon />
            {visMeta.label}
          </span>
          {club.openJoin ? (
            <span className="pill open-join" title="Anyone can join">
              <span className="dot"></span>
              Open
            </span>
          ) : null}
        </div>
      </div>

      <div className="cc-body">
        <h3 className="cc-title">{club.name}</h3>

        {club.description ? (
          <p className="cc-desc">{club.description}</p>
        ) : null}

        {visibleTags.length > 0 ? (
          <div className="tag-row">
            {visibleTags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
            {extraTagCount > 0 ? (
              <span className="tag">+{extraTagCount} more</span>
            ) : null}
          </div>
        ) : null}

        {club.currentBook ? (
          <p className="cc-reading">
            📖 Reading <i>{club.currentBook.title}</i>
          </p>
        ) : (
          <p className="cc-reading text-[var(--canvas-dark-ink-muted)] italic">
            No current book
          </p>
        )}

        <div className="cc-foot">
          {owner?.username ? (
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
          ) : (
            <span />
          )}
          <div className="cc-stats">
            <span className="cc-stat">
              <Users />
              {club.memberCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
