'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { addSparkEntryCommentAction } from '@/lib/actions/sparks.actions'
import type { EntryComment } from '@/lib/actions/sparks.actions'

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

export function SparkEntryCommentsPanel({ entryId, locale, initialComments, hasMore, isAuthenticated }: Props) {
  const [comments, setComments] = useState(initialComments)
  const [draft, setDraft] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!draft.trim() || !isAuthenticated) return
    setError(null)
    const content = draft.trim()
    setDraft('')
    startTransition(async () => {
      const result = await addSparkEntryCommentAction(entryId, content)
      if (result.success) {
        setComments(prev => [result.data, ...prev])
      } else {
        setError('Failed to post comment.')
        setDraft(content)
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
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
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
          <Link href={`/${locale}/sign-in`} className="text-[#FFC300] hover:underline">Sign in</Link> to leave a comment.
        </p>
      )}

      <div className="flex flex-col gap-3.5">
        {comments.map(comment => (
          <div key={comment.id} className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#2a2a2a] shrink-0 overflow-hidden flex items-center justify-center text-[11px]">
              {comment.authorAvatarUrl ? (
                <img src={comment.authorAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : '✍'}
            </div>
            <div>
              <p className="text-[12px] mb-0.5">
                <strong className="text-[#aaa]">{comment.authorDisplayName ?? comment.authorUsername}</strong>
                {' '}
                <span className="text-[#555] text-[11px]">{timeAgo(comment.createdAt)}</span>
              </p>
              <p className="text-[#777] text-[12px] leading-relaxed">{comment.content}</p>
            </div>
          </div>
        ))}
        {hasMore && (
          <p className="text-[#555] text-[12px] text-center pt-1 cursor-pointer hover:text-[#888]">
            Show more comments
          </p>
        )}
      </div>
    </div>
  )
}
