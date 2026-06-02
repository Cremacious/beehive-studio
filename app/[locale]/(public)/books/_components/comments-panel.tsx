'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { addCommentAction } from '@/lib/actions/social.actions'
import { getBookCommentsAction, type BookComment } from '@/lib/actions/discover.actions'

type Props = {
  bookId: string
  locale: string
  initialComments: BookComment[]
  initialHasMore: boolean
  initialCount: number
  isAuthenticated: boolean
  viewerAvatarUrl: string | null
}

function relTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

const COMMENT_AVATAR_GRADIENTS = [
  'linear-gradient(150deg, oklch(0.62 0.13 20), oklch(0.48 0.1 12))',
  'linear-gradient(150deg, oklch(0.6 0.12 155), oklch(0.46 0.1 165))',
  'linear-gradient(150deg, oklch(0.6 0.12 290), oklch(0.46 0.1 300))',
  'linear-gradient(150deg, oklch(0.6 0.13 250), oklch(0.46 0.1 280))',
  'linear-gradient(150deg, oklch(0.6 0.13 90), oklch(0.46 0.1 70))',
] as const

function avatarGradientFor(seed: string | null | undefined): string {
  if (!seed) return COMMENT_AVATAR_GRADIENTS[0]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return COMMENT_AVATAR_GRADIENTS[h % COMMENT_AVATAR_GRADIENTS.length]
}

function initialsFor(c: BookComment): string {
  const name = c.authorDisplayName ?? c.authorUsername ?? ''
  if (!name) return '??'
  const parts = name.replace(/^@/, '').split(/[\s_.\-]+/).filter(Boolean)
  if (parts.length === 0) return name.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function CommentsPanel({
  bookId,
  locale,
  initialComments,
  initialHasMore,
  initialCount,
  isAuthenticated,
  viewerAvatarUrl,
}: Props) {
  const [comments, setComments] = useState(initialComments)
  const [count, setCount] = useState(initialCount)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [page, setPage] = useState(1)
  const [draft, setDraft] = useState('')
  const [isPending, startTransition] = useTransition()

  const submit = () => {
    const trimmed = draft.trim()
    if (!trimmed || !isAuthenticated) return
    setDraft('')
    startTransition(async () => {
      const result = await addCommentAction(bookId, trimmed)
      if (result.success) {
        setComments((prev) => [result.data, ...prev])
        setCount((c) => c + 1)
      } else {
        setDraft(trimmed)
        toast.error('Could not post comment')
      }
    })
  }

  const loadMore = () => {
    startTransition(async () => {
      const nextPage = page + 1
      const result = await getBookCommentsAction(bookId, nextPage)
      if (result.success) {
        setComments((prev) => [...prev, ...result.data.comments])
        setHasMore(result.data.hasMore)
        setPage(nextPage)
      } else {
        toast.error('Could not load more comments')
      }
    })
  }

  return (
    <section
      id="comments"
      className="scroll-mt-20 rounded-[var(--r-card)]"
      style={{
        padding: '30px 32px 32px',
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
    >
      <div className="mb-[22px] flex items-baseline justify-between gap-4">
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '22px',
            letterSpacing: '-0.01em',
            color: 'var(--brand)',
            margin: 0,
          }}
        >
          Comments
        </h2>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            letterSpacing: '0.08em',
            color: 'var(--canvas-dark-ink-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          <b style={{ color: 'var(--canvas-dark-ink-strong)', fontWeight: 500 }}>{count}</b>{' '}
          comments
        </span>
      </div>

      {isAuthenticated ? (
        <div className="mb-[26px] flex" style={{ gap: '12px' }}>
          {viewerAvatarUrl ? (
            <img
              src={viewerAvatarUrl}
              alt=""
              style={{
                width: '36px',
                height: '36px',
                flexShrink: 0,
                borderRadius: 'var(--r-pill)',
                objectFit: 'cover',
              }}
            />
          ) : (
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: '36px',
                height: '36px',
                flexShrink: 0,
                borderRadius: 'var(--r-pill)',
                background:
                  'linear-gradient(150deg, var(--brand), var(--brand-active, var(--brand)))',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: '11px',
                color: 'var(--brand-ink)',
                letterSpacing: '0.05em',
              }}
            >
              YOU
            </span>
          )}
          <div className="flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a comment…"
              aria-label="Add a comment"
              maxLength={1000}
              style={{
                width: '100%',
                minHeight: '76px',
                resize: 'vertical',
                padding: '12px 14px',
                border: 0,
                borderRadius: 'var(--r-row)',
                background: 'var(--canvas-dark-100)',
                boxShadow: 'var(--sh-inset)',
                color: 'var(--canvas-dark-ink-strong)',
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                lineHeight: 1.5,
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow =
                  'var(--sh-inset), 0 0 0 1px oklch(0.85 0.18 90 / 0.4)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'var(--sh-inset)'
              }}
            />
            <div className="mt-[10px] flex justify-end">
              <button
                type="button"
                onClick={submit}
                disabled={isPending || !draft.trim()}
                style={{
                  padding: '9px 20px',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--brand)',
                  color: 'var(--brand-ink)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: '14px',
                  border: 0,
                  cursor: 'pointer',
                  boxShadow: '0 1px 0 0 oklch(1 0 0 / 0.2) inset',
                  opacity: isPending || !draft.trim() ? 0.4 : 1,
                  transition: 'background .14s',
                }}
              >
                Post
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="mb-[26px]"
          style={{
            padding: '16px 18px',
            borderRadius: 'var(--r-row)',
            background: 'var(--canvas-dark-100)',
            boxShadow: 'var(--sh-inset)',
            color: 'var(--canvas-dark-ink-muted)',
            fontSize: '14px',
          }}
        >
          <Link
            href={`/${locale}/sign-in`}
            style={{
              color: 'var(--brand)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
            className="hover:underline"
          >
            Sign in
          </Link>{' '}
          to join the conversation and leave a comment.
        </div>
      )}

      {comments.length === 0 ? (
        <p
          className="italic"
          style={{ color: 'var(--canvas-dark-ink-muted)', fontSize: '14px', margin: 0 }}
        >
          No comments yet.
        </p>
      ) : (
        <div className="flex flex-col" style={{ gap: '4px' }}>
          {comments.map((c, idx) => (
            <article
              key={c.id}
              className="flex"
              style={{
                gap: '12px',
                padding: '16px 0',
                borderTop:
                  idx === 0 ? '0' : '1px solid var(--canvas-dark-300)',
              }}
            >
              {c.authorAvatarUrl ? (
                <img
                  src={c.authorAvatarUrl}
                  alt=""
                  style={{
                    width: '36px',
                    height: '36px',
                    flexShrink: 0,
                    borderRadius: 'var(--r-pill)',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    width: '36px',
                    height: '36px',
                    flexShrink: 0,
                    borderRadius: 'var(--r-pill)',
                    background: avatarGradientFor(c.authorUsername ?? c.authorDisplayName),
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '13px',
                    color: 'oklch(0.97 0.01 250)',
                  }}
                >
                  {initialsFor(c)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div
                  className="flex items-baseline"
                  style={{ gap: '10px', marginBottom: '4px' }}
                >
                  {c.authorUsername ? (
                    <Link
                      href={`/${locale}/u/${c.authorUsername}`}
                      style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        color: 'var(--canvas-dark-ink-strong)',
                        textDecoration: 'none',
                      }}
                      className="hover:underline"
                    >
                      @{c.authorUsername}
                    </Link>
                  ) : (
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        color: 'var(--canvas-dark-ink-strong)',
                      }}
                    >
                      {c.authorDisplayName ?? 'Anonymous'}
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      letterSpacing: '0.04em',
                      color: 'var(--canvas-dark-ink-muted)',
                    }}
                  >
                    {relTime(c.createdAt)}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.55,
                    color: 'var(--canvas-dark-ink)',
                    whiteSpace: 'pre-line',
                    margin: 0,
                  }}
                >
                  {c.content}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={isPending}
          style={{
            width: '100%',
            marginTop: '18px',
            padding: '13px',
            borderRadius: 'var(--r-row)',
            background:
              'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
            boxShadow: 'var(--sh-tile)',
            color: 'var(--canvas-dark-ink)',
            fontFamily: 'var(--font-ui)',
            fontWeight: 500,
            fontSize: '14px',
            border: 0,
            cursor: isPending ? 'default' : 'pointer',
            opacity: isPending ? 0.6 : 1,
            transition: 'color .14s',
          }}
        >
          Load more comments
        </button>
      )}
    </section>
  )
}
