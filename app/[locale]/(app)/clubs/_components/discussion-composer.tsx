'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { createClubDiscussionAction } from '@/lib/actions/book-clubs.actions'

type Props = {
  clubId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TITLE_MAX = 120
const CONTENT_MAX = 10000

export function DiscussionComposer({ clubId, open, onOpenChange }: Props) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (!open) {
      setTitle('')
      setContent('')
    }
  }, [open])

  const submit = () => {
    const t = title.trim()
    const c = content.trim()
    if (!t || !c) return
    startTransition(async () => {
      const result = await createClubDiscussionAction({
        clubId,
        title: t,
        content: c,
      })
      if (result.success) {
        toast.success('Discussion posted')
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(
          result.error === 'NOT_ALLOWED'
            ? 'You do not have permission to post.'
            : 'Could not post discussion',
        )
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Discussion</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label
              htmlFor="discussion-title"
              className="block text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-1"
            >
              Title
            </label>
            <input
              id="discussion-title"
              type="text"
              autoFocus
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full rounded-[var(--r-row)] px-3 py-2 text-sm outline-none"
              style={{
                background: 'var(--canvas-dark-100)',
                color: 'var(--canvas-dark-ink-strong)',
                boxShadow: 'var(--sh-inset)',
              }}
            />
            <p className="mt-1 text-[10px] text-[var(--canvas-dark-ink-muted)] text-right">
              {title.length}/{TITLE_MAX}
            </p>
          </div>
          <div>
            <label
              htmlFor="discussion-content"
              className="block text-[10px] font-mono uppercase tracking-wider text-[var(--canvas-dark-ink-muted)] mb-1"
            >
              Content
            </label>
            <textarea
              id="discussion-content"
              rows={6}
              value={content}
              maxLength={CONTENT_MAX}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts…"
              className="w-full rounded-[var(--r-row)] px-3 py-2 text-sm outline-none resize-none"
              style={{
                background: 'var(--canvas-dark-100)',
                color: 'var(--canvas-dark-ink-strong)',
                boxShadow: 'var(--sh-inset)',
              }}
            />
            <p className="mt-1 text-[10px] text-[var(--canvas-dark-ink-muted)] text-right">
              {content.length}/{CONTENT_MAX}
            </p>
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="px-3 py-1.5 rounded-[var(--r-pill)] text-sm text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !title.trim() || !content.trim()}
            className="px-3 py-1.5 rounded-[var(--r-pill)] text-sm font-semibold disabled:opacity-50"
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
            }}
          >
            {isPending ? 'Posting…' : 'Post Discussion'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
