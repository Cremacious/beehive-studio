'use client'

import Link from 'next/link'
import type { BookClubMemberRole } from '@/db/schema/social'
import type {
  ClubDiscussionRow,
  ClubDiscussionReply,
} from '@/lib/actions/book-clubs.actions'
import { relTime } from '../../friends/_components/shared'
import { LikeButton } from './like-button'
import { PinToggle } from './pin-toggle'
import { ReplyComposer } from './reply-composer'

type Props = {
  discussion: ClubDiscussionRow
  replies: ClubDiscussionReply[]
  viewerRole: BookClubMemberRole | null
  clubId: string
  locale: string
}

function AuthorHeader({
  author,
  createdAt,
  locale,
}: {
  author: ClubDiscussionRow['author']
  createdAt: Date
  locale: string
}) {
  const name = author.displayName ?? author.username ?? 'Unknown'
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--canvas-dark-ink-muted)]">
      {author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={author.avatarUrl}
          alt=""
          className="h-6 w-6 rounded-full object-cover"
        />
      ) : (
        <div className="h-6 w-6 rounded-full bg-[var(--canvas-dark-300)]" />
      )}
      <span className="text-[var(--canvas-dark-ink)]">{name}</span>
      {author.username && (
        <Link
          href={`/${locale}/u/${author.username}`}
          className="font-mono hover:text-[var(--brand)]"
        >
          @{author.username}
        </Link>
      )}
      <span>·</span>
      <span>{relTime(createdAt)}</span>
    </div>
  )
}

export function DiscussionDetail({
  discussion,
  replies,
  viewerRole,
  clubId,
  locale,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Post */}
      <article
        className="rounded-[var(--r-card)] p-6"
        style={{
          background:
            'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
          boxShadow: 'var(--sh-card)',
          border: '1px solid var(--br-card)',
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <h1
            className="text-2xl font-bold text-[var(--brand)] flex-1 min-w-0"
            style={{ fontFamily: 'var(--font-comfortaa)' }}
          >
            {discussion.title}
          </h1>
          <PinToggle
            discussionId={discussion.id}
            initialPinned={discussion.isPinned}
            viewerRole={viewerRole}
          />
        </div>
        <AuthorHeader
          author={discussion.author}
          createdAt={discussion.createdAt}
          locale={locale}
        />
        <div
          className="mt-4 text-sm leading-relaxed text-[var(--canvas-dark-ink)] whitespace-pre-wrap"
          style={{ fontFamily: 'var(--font-newsreader)' }}
        >
          {discussion.content}
        </div>
        <div className="mt-4 pt-3 border-t border-[var(--br-card)] flex items-center gap-4">
          <LikeButton
            variant="post"
            targetId={discussion.id}
            initialLiked={discussion.viewerLiked}
            initialCount={discussion.likeCount}
          />
        </div>
      </article>

      {/* Replies */}
      <section>
        <h2
          className="text-xs font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-3"
        >
          Replies ({replies.length})
        </h2>
        {replies.length === 0 ? (
          <p className="italic text-[var(--canvas-dark-ink-muted)] text-sm py-4">
            No replies yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {replies.map((r) => (
              <li
                key={r.id}
                className="rounded-[var(--r-card)] p-4"
                style={{
                  background:
                    'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
                  boxShadow: 'var(--sh-card)',
                  border: '1px solid var(--br-card)',
                }}
              >
                <AuthorHeader
                  author={r.author}
                  createdAt={r.createdAt}
                  locale={locale}
                />
                <div
                  className="mt-2 text-sm leading-relaxed text-[var(--canvas-dark-ink)] whitespace-pre-wrap"
                  style={{ fontFamily: 'var(--font-newsreader)' }}
                >
                  {r.content}
                </div>
                <div className="mt-3 pt-2 border-t border-[var(--br-card)]">
                  <LikeButton
                    variant="reply"
                    targetId={r.id}
                    initialLiked={r.viewerLiked}
                    initialCount={r.likeCount}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {viewerRole !== null && <ReplyComposer discussionId={discussion.id} />}
    </div>
  )
}
