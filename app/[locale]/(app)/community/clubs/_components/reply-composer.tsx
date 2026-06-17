'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { replyToClubDiscussionAction } from '@/lib/actions/book-clubs.actions'
import { MentionableTextarea } from '@/components/mentions/mentionable-textarea'

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
    <section className="panel panel-pad">
      <div style={{ display: 'flex', gap: '12px' }}>
        <span className="avatar s32 brand" aria-hidden="true">
          ME
        </span>
        <div style={{ flex: 1 }}>
          <MentionableTextarea
            id="reply-content"
            value={content}
            onChange={setContent}
            maxLength={5000}
            rows={3}
            placeholder="Add a reply…"
            className="input"
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '10px',
            }}
          >
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !content.trim()}
              className="btn-brand btn-sm"
              style={
                isPending || !content.trim()
                  ? { opacity: 0.5, cursor: 'not-allowed' }
                  : undefined
              }
            >
              {isPending ? 'Posting…' : 'Reply'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
