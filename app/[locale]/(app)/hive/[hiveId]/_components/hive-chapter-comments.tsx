'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { CommentRow } from '@/lib/actions/hive-collab.actions'
import { createHiveCommentAction, resolveHiveCommentAction } from '@/lib/actions/hive-collab.actions'

type Props = {
  hiveId: string
  chapterId: string
  comments: CommentRow[]
  onCommentAdded: () => void
}

export function HiveChapterComments({ hiveId, chapterId, comments, onCommentAdded }: Props) {
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim()) return
    setSubmitting(true)
    await createHiveCommentAction(hiveId, chapterId, newComment.trim())
    setNewComment('')
    setSubmitting(false)
    onCommentAdded()
  }

  async function handleResolve(commentId: string) {
    await resolveHiveCommentAction(commentId)
    onCommentAdded()
  }

  return (
    <div className="w-52 border-l border-border bg-card flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Comments
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {comments.map(c => (
          <div key={c.id} className={cn('rounded-md p-2 text-xs border-l-2', c.resolved ? 'opacity-50 border-border' : 'border-brand bg-surface-elevated')}>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-foreground font-medium">{c.author.name ?? 'Unknown'}</span>
              <span className="text-muted-foreground ml-auto">{new Date(c.createdAt).toLocaleDateString()}</span>
            </div>
            {c.anchorStart && (
              <p className="text-muted-foreground italic mb-1 truncate">"{c.anchorStart}"</p>
            )}
            <p className="text-foreground/80 leading-relaxed">{c.content}</p>
            {!c.resolved && (
              <button onClick={() => handleResolve(c.id)} className="mt-1 text-muted-foreground hover:text-foreground transition-colors">
                Resolve
              </button>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="p-2 border-t border-border flex flex-col gap-1.5">
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Add a comment…"
          className="resize-none bg-surface-inset border border-border rounded p-1.5 text-xs outline-none focus:border-brand/40 min-h-14"
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="text-xs px-2 py-1 rounded bg-brand text-black font-medium disabled:opacity-40"
        >
          Comment
        </button>
      </form>
    </div>
  )
}
