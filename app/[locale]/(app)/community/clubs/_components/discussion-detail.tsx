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
import { RenderMentionsInText } from '@/components/mentions/render-mentions-in-text'

type Props = {
  discussion: ClubDiscussionRow
  replies: ClubDiscussionReply[]
  viewerRole: BookClubMemberRole | null
  clubId: string
  locale: string
}

function Avatar({
  author,
  size,
}: {
  author: ClubDiscussionRow['author']
  size: 's32' | 's40'
}) {
  const name = author.displayName ?? author.username ?? 'Unknown'
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0] ?? '')
    .join('')
    .toUpperCase()
  if (author.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={author.avatarUrl}
        alt=""
        className={`avatar ${size}`}
        style={{ objectFit: 'cover' }}
      />
    )
  }
  return <span className={`avatar ${size} a-slate`}>{initials || '??'}</span>
}

export function DiscussionDetail({
  discussion,
  replies,
  viewerRole,
  clubId,
  locale,
}: Props) {
  void clubId
  const postAuthorName =
    discussion.author.displayName ?? discussion.author.username ?? 'Unknown'

  return (
    <>
      {/* Post */}
      <article className="panel panel-pad" style={{ marginBottom: '24px' }}>
        <div className="author-head">
          <div className="ah-l">
            <Avatar author={discussion.author} size="s40" />
            <div>
              <div className="ah-name">{postAuthorName}</div>
              <div className="ah-meta">
                {discussion.author.username ? (
                  <Link
                    href={`/${locale}/u/${discussion.author.username}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    @{discussion.author.username}
                  </Link>
                ) : (
                  'anonymous'
                )}
                {' · '}
                {relTime(discussion.createdAt)}
              </div>
            </div>
          </div>
          <PinToggle
            discussionId={discussion.id}
            initialPinned={discussion.isPinned}
            viewerRole={viewerRole}
          />
        </div>
        <div
          className="post-body"
          style={{
            fontFamily: 'var(--font-prose)',
            fontSize: '16px',
            lineHeight: 1.7,
            color: 'var(--canvas-dark-ink)',
            margin: '18px 0',
            whiteSpace: 'pre-wrap',
          }}
        >
          <RenderMentionsInText text={discussion.content} />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            paddingTop: '16px',
            borderTop:
              '1px solid oklch(from var(--canvas-dark-300) l c h / 0.5)',
          }}
        >
          <LikeButton
            variant="post"
            targetId={discussion.id}
            initialLiked={discussion.viewerLiked}
            initialCount={discussion.likeCount}
          />
        </div>
      </article>

      {/* Replies header */}
      <h2
        style={{
          fontFamily: 'var(--font-display, var(--font-comfortaa))',
          fontWeight: 700,
          fontSize: '17px',
          color: 'var(--canvas-dark-ink-strong)',
          margin: '0 0 16px',
        }}
      >
        {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
      </h2>

      {/* Replies list */}
      {replies.length === 0 ? (
        <section
          className="panel panel-pad"
          style={{ marginBottom: '20px' }}
        >
          <p
            className="italic"
            style={{
              color: 'var(--canvas-dark-ink-muted)',
              fontSize: '14px',
              margin: 0,
            }}
          >
            No replies yet.
          </p>
        </section>
      ) : (
        <section
          className="panel panel-pad"
          style={{ marginBottom: '20px' }}
        >
          <ul className="cstack" style={{ gap: '20px' }}>
            {replies.map((r) => {
              const replyName =
                r.author.displayName ?? r.author.username ?? 'Unknown'
              return (
                <li
                  key={r.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr',
                    gap: '12px',
                  }}
                >
                  <Avatar author={r.author} size="s32" />
                  <div>
                    <span
                      style={{
                        fontFamily:
                          'var(--font-display, var(--font-comfortaa))',
                        fontWeight: 600,
                        fontSize: '13px',
                        color: 'var(--canvas-dark-ink-strong)',
                      }}
                    >
                      {r.author.username ? (
                        <Link
                          href={`/${locale}/u/${r.author.username}`}
                          style={{
                            textDecoration: 'none',
                            color: 'inherit',
                          }}
                        >
                          @{r.author.username}
                        </Link>
                      ) : (
                        replyName
                      )}
                    </span>{' '}
                    <span className="meta-mono">{relTime(r.createdAt)}</span>
                    <p
                      style={{
                        fontSize: '14px',
                        color: 'var(--canvas-dark-ink)',
                        lineHeight: 1.55,
                        margin: '5px 0 0',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      <RenderMentionsInText text={r.content} />
                    </p>
                    <div style={{ marginTop: '8px' }}>
                      <LikeButton
                        variant="reply"
                        targetId={r.id}
                        initialLiked={r.viewerLiked}
                        initialCount={r.likeCount}
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {viewerRole !== null && <ReplyComposer discussionId={discussion.id} />}
    </>
  )
}
