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
      className="scroll-mt-20 rounded-[var(--r-card)] p-6"
      style={{
        background: 'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        borderTop: '1px solid var(--br-card)',
      }}
    >
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="font-comfortaa text-lg font-bold text-[var(--brand)]">Comments</h2>
        <span className="text-xs text-[var(--canvas-dark-ink-muted)]">{count}</span>
      </div>

      {isAuthenticated ? (
        <div className="mb-5 flex gap-3">
          {viewerAvatarUrl ? (
            <img
              src={viewerAvatarUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--canvas-dark-300)]" />
          )}
          <div className="flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              maxLength={1000}
              className="w-full resize-none rounded-[var(--r-row)] bg-[var(--canvas-dark-100)] px-3 py-2 text-sm text-[var(--canvas-dark-ink-strong)] outline-none placeholder:text-[var(--canvas-dark-ink-muted)]"
              style={{ boxShadow: 'var(--sh-inset)' }}
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={submit}
                disabled={isPending || !draft.trim()}
                className="rounded-[var(--r-btn)] bg-[var(--brand)] px-4 py-1.5 text-sm font-semibold text-[var(--brand-ink)] disabled:opacity-40"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mb-5 text-sm text-[var(--canvas-dark-ink-muted)]">
          <Link
            href={`/${locale}/sign-in`}
            className="text-[var(--brand)] hover:underline"
          >
            Sign in
          </Link>{' '}
          to leave a comment.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm italic text-[var(--canvas-dark-ink-muted)]">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              {c.authorAvatarUrl ? (
                <img
                  src={c.authorAvatarUrl}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--canvas-dark-300)]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  {c.authorUsername ? (
                    <Link
                      href={`/${locale}/u/${c.authorUsername}`}
                      className="text-sm font-semibold text-[var(--canvas-dark-ink-strong)] hover:underline"
                    >
                      {c.authorDisplayName ?? `@${c.authorUsername}`}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-[var(--canvas-dark-ink-strong)]">
                      {c.authorDisplayName ?? 'Anonymous'}
                    </span>
                  )}
                  <span className="text-xs text-[var(--canvas-dark-ink-muted)]">
                    {relTime(c.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--canvas-dark-ink)]">
                  {c.content}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={isPending}
            className="rounded-[var(--r-btn)] px-4 py-1.5 text-sm text-[var(--canvas-dark-ink)] disabled:opacity-40"
            style={{
              background: 'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
              boxShadow: 'var(--sh-tile)',
            }}
          >
            Load more
          </button>
        </div>
      )}
    </section>
  )
}
