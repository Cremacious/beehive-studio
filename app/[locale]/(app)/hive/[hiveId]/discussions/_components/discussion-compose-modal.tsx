'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { createDiscussionPostAction } from '@/lib/actions/hive-discussions.actions'
import type { DiscussionTopic } from '@/lib/validations/hive-discussion'
import { TOPIC_META } from './discussion-row'

const TOPICS: DiscussionTopic[] = ['GENERAL', 'WORLDBUILDING', 'FEEDBACK', 'OFF_TOPIC']

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  hiveId: string
}

export function DiscussionComposeModal({ open, onOpenChange, hiveId }: Props) {
  const router = useRouter()
  const [topic, setTopic] = useState<DiscussionTopic>('GENERAL')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = body.trim().length > 0 && !submitting

  function reset() {
    setTopic('GENERAL')
    setTitle('')
    setBody('')
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      // The server derives a title from the first 80 chars of body. If the user
      // supplied a title, prepend it so the derived title surfaces theirs.
      const composedBody = title.trim()
        ? `${title.trim()}\n\n${body.trim()}`
        : body.trim()
      const result = await createDiscussionPostAction({
        hiveId,
        topic,
        body: composedBody,
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Post created')
      reset()
      onOpenChange(false)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (submitting) return
    if (!next) reset()
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New discussion</DialogTitle>
          <DialogDescription>
            Start a thread for your hive. Pick a topic so members can filter.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => {
            const active = t === topic
            const meta = TOPIC_META[t]
            const color = `var(${meta.tokenVar}, var(--color-brand))`
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(t)}
                aria-pressed={active}
                className={
                  'flex-1 min-w-[120px] rounded-md border px-3 py-2 text-left transition ' +
                  (active
                    ? 'border-2 border-brand bg-brand/10'
                    : 'border-border hover:border-brand/60')
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="text-sm font-medium">{meta.label}</span>
                </div>
              </button>
            )
          })}
        </div>

        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional — first 80 chars of body if blank)"
          maxLength={80}
        />

        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's on your mind?"
          rows={8}
          autoFocus
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Posting…' : 'Post'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
