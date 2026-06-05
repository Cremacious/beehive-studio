import Link from 'next/link'
import { Heart, MessageCircle, Pin } from 'lucide-react'
import type { ClubDiscussionRow } from '@/lib/actions/book-clubs.actions'
import { relTime } from '../../friends/_components/shared'

type Props = {
  discussion: ClubDiscussionRow
  clubId: string
  locale: string
}

export function DiscussionCard({ discussion, clubId, locale }: Props) {
  const authorName =
    discussion.author.displayName ?? discussion.author.username ?? 'Unknown'
  const authorHandle = discussion.author.username
  const href = `/${locale}/clubs/${clubId}/discussions/${discussion.id}`

  return (
    <Link
      href={href}
      className="block rounded-[var(--r-card)] border border-[var(--br-card)] bg-[var(--canvas-dark-200)] p-4 transition hover:bg-[var(--canvas-dark-250)]"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {discussion.isPinned && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--r-pill)] text-[10px] font-mono uppercase tracking-wider"
                style={{
                  background:
                    'oklch(from var(--brand) l c h / 0.14)',
                  color: 'var(--brand)',
                  border: '1px solid oklch(from var(--brand) l c h / 0.3)',
                }}
              >
                <Pin className="h-2.5 w-2.5" /> Pinned
              </span>
            )}
            <h3
              className="font-bold text-[var(--canvas-dark-ink-strong)] truncate"
              style={{ fontFamily: 'var(--font-comfortaa)' }}
            >
              {discussion.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--canvas-dark-ink-muted)]">
            {discussion.author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={discussion.author.avatarUrl}
                alt=""
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-[var(--canvas-dark-300)]" />
            )}
            <span className="text-[var(--canvas-dark-ink)]">{authorName}</span>
            {authorHandle && (
              <span className="font-mono">@{authorHandle}</span>
            )}
            <span>·</span>
            <span>{relTime(discussion.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--canvas-dark-ink-muted)] shrink-0">
          <span className="inline-flex items-center gap-1">
            <Heart
              className={`h-3.5 w-3.5 ${discussion.viewerLiked ? 'fill-current text-[var(--brand)]' : ''}`}
            />
            {discussion.likeCount}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {discussion.replyCount}
          </span>
        </div>
      </div>
    </Link>
  )
}
