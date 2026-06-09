'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  addSparkEntryCommentAction,
  replyToSparkCommentAction,
} from '@/lib/actions/sparks.actions'
import type { EntryComment } from '@/lib/actions/sparks.actions'
import { MentionableTextarea } from '@/components/mentions/mentionable-textarea'
import { RenderMentionsInText } from '@/components/mentions/render-mentions-in-text'

type Props = {
  entryId: string
  locale: string
  initialComments: EntryComment[]
  hasMore: boolean
  isAuthenticated: boolean
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

const inputStyle = {
  background: '#1E1E1E',
  boxShadow: 'var(--sh-inset)',
  color: 'var(--canvas-dark-ink)',
} as const

function Avatar({ url, size = 28 }: { url?: string | null; size?: number }) {
  return (
    <div
      className="rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[11px]"
      style={{
        width: size,
        height: size,
        background: 'var(--canvas-dark-300)',
        color: 'var(--canvas-dark-ink-muted)',
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        '✍'
      )}
    </div>
  )
}

function CommentRow({
  comment,
  isReply,
  onReplyClick,
  replyOpen,
}: {
  comment: EntryComment
  isReply: boolean
  onReplyClick?: () => void
  replyOpen?: boolean
}) {
  return (
    <div className="flex gap-2.5">
      <Avatar url={comment.authorAvatarUrl} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] mb-0.5">
          <strong
            className="font-semibold"
            style={{
              color: 'var(--canvas-dark-ink-strong)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {comment.authorDisplayName ?? comment.authorUsername}
          </strong>{' '}
          <span
            className="text-[11px]"
            style={{ color: 'var(--canvas-dark-ink-faint)' }}
          >
            {timeAgo(comment.createdAt)}
          </span>
        </p>
        <p
          className="text-[13px] leading-relaxed whitespace-pre-wrap"
          style={{ color: 'var(--canvas-dark-ink)' }}
        >
          <RenderMentionsInText text={comment.content} />
        </p>
        {!isReply && onReplyClick && (
          <button
            type="button"
            onClick={onReplyClick}
            className="mt-1 text-[11px] cursor-pointer transition-colors"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--brand)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--canvas-dark-ink-muted)'
            }}
          >
            {replyOpen ? 'Cancel' : 'Reply'}
          </button>
        )}
      </div>
    </div>
  )
}

function ReplyComposer({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (content: string) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [draft, setDraft] = useState('')

  const submit = () => {
    const content = draft.trim()
    if (!content) return
    onSubmit(content)
    setDraft('')
  }

  return (
    <div className="flex gap-2.5 mt-2">
      <Avatar />
      <div className="flex-1">
        <MentionableTextarea
          value={draft}
          onChange={setDraft}
          placeholder="Write a reply…"
          rows={2}
          maxLength={1000}
          className="w-full px-3 py-2 text-[13px] resize-none outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
          style={{ ...inputStyle, borderRadius: 'var(--r-row)' }}
        />
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !draft.trim()}
            className="inline-flex items-center justify-center h-8 px-4 rounded-[var(--r-pill)] text-[12px] font-semibold disabled:opacity-40 cursor-pointer"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            Reply
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="inline-flex items-center justify-center h-8 px-3 rounded-[var(--r-pill)] text-[12px] cursor-pointer"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export function SparkEntryCommentsPanel({
  entryId,
  locale,
  initialComments,
  hasMore,
  isAuthenticated,
}: Props) {
  const router = useRouter()
  const [comments, setComments] = useState(initialComments)
  const [draft, setDraft] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  const { topLevel, repliesByParent } = useMemo(() => {
    const top: EntryComment[] = []
    const byParent = new Map<string, EntryComment[]>()
    for (const c of comments) {
      if (c.parentId === null) {
        top.push(c)
      } else {
        const arr = byParent.get(c.parentId) ?? []
        arr.push(c)
        byParent.set(c.parentId, arr)
      }
    }
    return { topLevel: top, repliesByParent: byParent }
  }, [comments])

  const submit = () => {
    if (!draft.trim() || !isAuthenticated) return
    setError(null)
    const content = draft.trim()
    setDraft('')
    startTransition(async () => {
      const result = await addSparkEntryCommentAction(entryId, content)
      if (result.success) {
        setComments((prev) => [result.data, ...prev])
      } else {
        setError('Failed to post comment.')
        setDraft(content)
      }
    })
  }

  const submitReply = (parentId: string, content: string) => {
    startTransition(async () => {
      const result = await replyToSparkCommentAction({ entryId, parentId, content })
      if (result.success) {
        setReplyingTo(null)
        toast.success('Reply posted')
        router.refresh()
      } else {
        const msg =
          result.error === 'REPLY_DEPTH_EXCEEDED'
            ? "Can't reply to a reply"
            : result.error === 'BLOCKED'
              ? 'You can no longer reply here.'
              : 'Could not post reply'
        toast.error(msg)
      }
    })
  }

  return (
    <div>
      <p
        className="text-[10px] font-mono uppercase tracking-[0.14em] mb-4"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        Comments · {comments.length}
      </p>

      {isAuthenticated ? (
        <div className="flex gap-2.5 mb-5">
          <Avatar />
          <div className="flex-1">
            <MentionableTextarea
              value={draft}
              onChange={setDraft}
              placeholder="Add a comment…"
              rows={2}
              maxLength={1000}
              className="w-full px-3 py-2 text-[13px] resize-none outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
              style={{ ...inputStyle, borderRadius: 'var(--r-row)' }}
            />
            {error && (
              <p
                className="text-[11px] mt-1"
                style={{ color: 'var(--status-error)' }}
              >
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={isPending || !draft.trim()}
              className="mt-2 inline-flex items-center justify-center h-8 px-4 rounded-[var(--r-pill)] text-[12px] font-semibold disabled:opacity-40 cursor-pointer"
              style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
            >
              Post
            </button>
          </div>
        </div>
      ) : (
        <p
          className="text-[13px] mb-5"
          style={{ color: 'var(--canvas-dark-ink-muted)' }}
        >
          <Link
            href={`/${locale}/sign-in`}
            className="hover:underline"
            style={{ color: 'var(--brand)' }}
          >
            Sign in
          </Link>{' '}
          to leave a comment.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {topLevel.map((c) => {
          const replies = repliesByParent.get(c.id) ?? []
          const isReplyOpen = replyingTo === c.id
          return (
            <div
              key={c.id}
              className="pb-4 last:pb-0"
              style={{
                borderBottom:
                  topLevel.indexOf(c) < topLevel.length - 1
                    ? '1px solid oklch(1 0 0 / 0.08)'
                    : undefined,
              }}
            >
              <CommentRow
                comment={c}
                isReply={false}
                onReplyClick={
                  isAuthenticated
                    ? () => setReplyingTo(isReplyOpen ? null : c.id)
                    : undefined
                }
                replyOpen={isReplyOpen}
              />

              {replies.length > 0 && (
                <div
                  className="ml-9 pl-4 mt-3 space-y-3"
                  style={{ borderLeft: '1px solid oklch(1 0 0 / 0.08)' }}
                >
                  {replies.map((r) => (
                    <CommentRow key={r.id} comment={r} isReply={true} />
                  ))}
                </div>
              )}

              {isReplyOpen && isAuthenticated && (
                <div className="ml-9 pl-4">
                  <ReplyComposer
                    onSubmit={(content) => submitReply(c.id, content)}
                    onCancel={() => setReplyingTo(null)}
                    isPending={isPending}
                  />
                </div>
              )}
            </div>
          )
        })}
        {hasMore && (
          <p
            className="text-[12px] text-center pt-1 cursor-pointer transition-colors"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Show more comments
          </p>
        )}
      </div>
    </div>
  )
}
