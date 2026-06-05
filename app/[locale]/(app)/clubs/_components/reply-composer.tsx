'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { replyToClubDiscussionAction } from '@/lib/actions/book-clubs.actions'

type Props = {
  discussionId: string
}

export function ReplyComposer({ discussionId }: Props) {
  const [content, setContent] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = () => {
    const trimmed = content.trim()
    if (!trimmed) return

    startTransition(async () => {
      const result = await replyToClubDiscussionAction({
        discussionId,
        content: trimmed,
      })
      if (!result.success) {
        toast.error('Could not post reply')
        return
      }
      setContent('')
      toast.success('Reply posted')
      router.refresh()
    })
  }

  return (
    <div
      className="rounded-[var(--r-card)] p-4 mt-6"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-250), var(--canvas-dark-200))',
        boxShadow: 'var(--sh-card)',
        border: '1px solid var(--br-card)',
      }}
    >
      <label
        htmlFor="reply-content"
        className="block text-xs font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-2"
      >
        Write a reply
      </label>
      <textarea
        id="reply-content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={5000}
        rows={3}
        placeholder="Share your thoughts…"
        className="w-full px-3 py-2 rounded-[var(--r-row)] bg-[var(--canvas-dark-100)] text-sm text-[var(--canvas-dark-ink)] placeholder:text-[var(--canvas-dark-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] resize-y"
        style={{ boxShadow: 'var(--sh-inset)' }}
      />
      <div className="flex justify-end mt-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !content.trim()}
          className="px-4 py-2 rounded-[var(--r-pill)] bg-[var(--brand)] text-[var(--brand-ink)] text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isPending ? 'Posting…' : 'Post reply'}
        </button>
      </div>
    </div>
  )
}
