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
      <div className="w-7 h-7 rounded-full bg-[#2a2a2a] shrink-0 overflow-hidden flex items-center justify-center text-[11px]">
        {comment.authorAvatarUrl ? (
          <img src={comment.authorAvatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          '✍'
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] mb-0.5">
          <strong className="text-[#aaa]">
            {comment.authorDisplayName ?? comment.authorUsername}
          </strong>{' '}
          <span className="text-[#555] text-[11px]">{timeAgo(comment.createdAt)}</span>
        </p>
        <p className="text-[#777] text-[12px] leading-relaxed whitespace-pre-wrap">
          <RenderMentionsInText text={comment.content} />
        </p>
        {!isReply && onReplyClick && (
          <button
            onClick={onReplyClick}
            className="mt-1 text-[#555] text-[11px] hover:text-[#FFC300] cursor-pointer"
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
      <div className="w-7 h-7 rounded-full bg-[#2a2a2a] shrink-0" />
      <div className="flex-1">
        <MentionableTextarea
          value={draft}
          onChange={setDraft}
          placeholder="Write a reply…"
          rows={2}
          maxLength={1000}
          className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-md px-2.5 py-1.5 text-[#aaa] text-[12px] resize-none focus:outline-none focus:border-[#3a3a3a]"
        />
        <div className="flex gap-2 mt-1.5">
          <button
            onClick={submit}
            disabled={isPending || !draft.trim()}
            className="px-3 py-1 bg-[#FFC300] text-black text-[11px] font-semibold rounded disabled:opacity-40 cursor-pointer"
          >
            Reply
          </button>
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-3 py-1 bg-transparent border border-[#2a2a2a] text-[#888] text-[11px] rounded hover:text-[#aaa] cursor-pointer"
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
      <p className="text-[#666] text-[11px] uppercase tracking-widest mb-3">
        Comments · {comments.length}
      </p>

      {isAuthenticated ? (
        <div className="flex gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-full bg-[#2a2a2a] shrink-0" />
          <div className="flex-1">
            <MentionableTextarea
              value={draft}
              onChange={setDraft}
              placeholder="Add a comment…"
              rows={2}
              maxLength={1000}
              className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-md px-2.5 py-1.5 text-[#aaa] text-[12px] resize-none focus:outline-none focus:border-[#3a3a3a]"
            />
            {error && <p className="text-red-400 text-[11px] mt-1">{error}</p>}
            <button
              onClick={submit}
              disabled={isPending || !draft.trim()}
              className="mt-1.5 px-3 py-1 bg-[#FFC300] text-black text-[11px] font-semibold rounded disabled:opacity-40 cursor-pointer"
            >
              Post
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[#555] text-[12px] mb-4">
          <Link href={`/${locale}/sign-in`} className="text-[#FFC300] hover:underline">
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
              className="border-b border-[#2a2a2a] pb-3 last:border-b-0 last:pb-0"
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
                <div className="ml-8 border-l border-[#2a2a2a] pl-4 mt-3 space-y-3">
                  {replies.map((r) => (
                    <CommentRow key={r.id} comment={r} isReply={true} />
                  ))}
                </div>
              )}

              {isReplyOpen && isAuthenticated && (
                <div className="ml-8 pl-4">
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
          <p className="text-[#555] text-[12px] text-center pt-1 cursor-pointer hover:text-[#888]">
            Show more comments
          </p>
        )}
      </div>
    </div>
  )
}
