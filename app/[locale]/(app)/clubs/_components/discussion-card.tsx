import Link from 'next/link'
import { Heart, MessageCircle, Pin } from 'lucide-react'
import type { ClubDiscussionRow } from '@/lib/actions/book-clubs.actions'
import { relTime } from '../../friends/_components/shared'

type Props = {
  discussion: ClubDiscussionRow
  clubId: string
  locale: string
}

const ACCENTS = ['a-mint', 'a-blue', 'a-coral', 'a-lilac', 'a-slate'] as const

function pickAccent(seed: string): (typeof ACCENTS)[number] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return ACCENTS[h % ACCENTS.length]
}

export function DiscussionCard({ discussion, clubId, locale }: Props) {
  const authorHandle = discussion.author.username
  const authorLabel =
    discussion.author.displayName ?? discussion.author.username ?? 'Unknown'
  const initials = authorLabel.slice(0, 2).toUpperCase()
  const accent = pickAccent(authorHandle ?? discussion.author.userId)
  const href = `/${locale}/clubs/${clubId}/discussions/${discussion.id}`

  const pinnedSuffix = discussion.isPinned ? 'Pinned · ' : ''

  return (
    <Link href={href} className="tile tile-pad is-interactive disc-card">
      <div>
        <h3 className="dc-title">
          {discussion.isPinned ? <Pin aria-hidden="true" /> : null}
          <span className="truncate">{discussion.title}</span>
        </h3>
        <div className="dc-meta">
          <span className="owner-card">
            {discussion.author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={discussion.author.avatarUrl}
                alt=""
                className="avatar s24"
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <span className={`avatar s24 ${accent}`} aria-hidden="true">
                {initials}
              </span>
            )}
            <span className="oc-handle">
              {authorHandle ? `@${authorHandle}` : authorLabel}
            </span>
          </span>
          <span className="dot-sep" aria-hidden="true" />
          <span className="meta-mono">
            {pinnedSuffix}
            {relTime(discussion.createdAt)}
          </span>
        </div>
      </div>
      <div className="dc-stats">
        <span className="cc-stat" aria-label={`${discussion.likeCount} likes`}>
          <Heart
            className={
              discussion.viewerLiked ? 'fill-current text-[var(--brand)]' : ''
            }
            aria-hidden="true"
          />
          {discussion.likeCount}
        </span>
        <span
          className="cc-stat"
          aria-label={`${discussion.replyCount} replies`}
        >
          <MessageCircle aria-hidden="true" />
          {discussion.replyCount}
        </span>
      </div>
    </Link>
  )
}
