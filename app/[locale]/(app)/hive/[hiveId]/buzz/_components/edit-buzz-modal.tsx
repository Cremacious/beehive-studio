'use client'

import { useEffect, useState } from 'react'
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
import { updateBuzzPostAction } from '@/lib/actions/hive-buzz.actions'
import type { BuzzPostSummary } from '@/lib/actions/hive-buzz.actions'

const TEXT_MAX = 1000
const CAPTION_MAX = 280

function isValidHttpsUrl(s: string): boolean {
  try {
    return new URL(s).protocol === 'https:'
  } catch {
    return false
  }
}

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  post: BuzzPostSummary
}

export function EditBuzzModal({ open, onOpenChange, post }: Props) {
  const router = useRouter()
  const [body, setBody] = useState(post.body)
  const [linkUrl, setLinkUrl] = useState(post.linkUrl ?? '')
  const [submitting, setSubmitting] = useState(false)

  // Sync if a different post is being edited (component reused).
  useEffect(() => {
    if (open) {
      setBody(post.body)
      setLinkUrl(post.linkUrl ?? '')
    }
  }, [open, post.id, post.body, post.linkUrl])

  const bodyTrimmed = body.trim()
  const linkValid = isValidHttpsUrl(linkUrl.trim())
  const canSubmit =
    !submitting &&
    (post.type === 'TEXT'
      ? bodyTrimmed.length > 0 && bodyTrimmed.length <= TEXT_MAX
      : linkValid && body.length <= CAPTION_MAX)

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const result = await updateBuzzPostAction({
        id: post.id,
        body: post.type === 'TEXT' ? bodyTrimmed : body.trim(),
        ...(post.type === 'LINK' ? { linkUrl: linkUrl.trim() } : {}),
      })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Updated')
      onOpenChange(false)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (submitting) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit buzz</DialogTitle>
          <DialogDescription>
            Update your post. The type can't be changed — delete and recreate to
            switch between text and link.
          </DialogDescription>
        </DialogHeader>

        <div className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-muted/40 text-muted-foreground w-fit">
          {post.type === 'TEXT' ? 'Text' : 'Link'} · locked
        </div>

        {post.type === 'TEXT' ? (
          <div className="space-y-1">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What's the buzz?"
              rows={5}
              maxLength={TEXT_MAX}
              autoFocus
            />
            <div className="flex justify-end text-[11px] text-muted-foreground">
              {body.length} / {TEXT_MAX}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Input
                type="url"
                inputMode="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                aria-invalid={linkUrl.length > 0 && !linkValid}
              />
              {linkUrl.length > 0 && !linkValid && (
                <p className="text-[11px] text-destructive">
                  Must be a valid https URL
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Optional caption..."
                rows={3}
                maxLength={CAPTION_MAX}
              />
              <div className="flex justify-end text-[11px] text-muted-foreground">
                {body.length} / {CAPTION_MAX}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
