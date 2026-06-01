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
import { createBuzzPostAction } from '@/lib/actions/hive-buzz.actions'
import type { BuzzPostType } from '@/lib/validations/hive-buzz'

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
  hiveId: string
}

export function ComposeBuzzModal({ open, onOpenChange, hiveId }: Props) {
  const router = useRouter()
  const [type, setType] = useState<BuzzPostType>('TEXT')
  const [body, setBody] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const bodyTrimmed = body.trim()
  const linkValid = isValidHttpsUrl(linkUrl.trim())
  const canSubmit =
    !submitting &&
    (type === 'TEXT'
      ? bodyTrimmed.length > 0 && bodyTrimmed.length <= TEXT_MAX
      : linkValid && body.length <= CAPTION_MAX)

  function reset() {
    setType('TEXT')
    setBody('')
    setLinkUrl('')
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const result =
        type === 'TEXT'
          ? await createBuzzPostAction({
              type: 'TEXT',
              hiveId,
              body: bodyTrimmed,
            })
          : await createBuzzPostAction({
              type: 'LINK',
              hiveId,
              body: body.trim(),
              linkUrl: linkUrl.trim(),
            })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Posted')
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
          <DialogTitle>New buzz</DialogTitle>
          <DialogDescription>
            Share an inspiration, a link, or just a vibe with your hive.
          </DialogDescription>
        </DialogHeader>

        <div className="inline-flex gap-1 p-1 rounded-full bg-muted/40 w-fit">
          {(['TEXT', 'LINK'] as BuzzPostType[]).map((t) => {
            const active = t === type
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={active}
                className={
                  'px-4 py-1.5 rounded-full text-xs font-semibold transition ' +
                  (active
                    ? 'bg-brand text-brand-ink'
                    : 'text-muted-foreground hover:text-foreground')
                }
              >
                {t === 'TEXT' ? 'Text' : 'Link'}
              </button>
            )
          })}
        </div>

        {type === 'TEXT' ? (
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
                autoFocus
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
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              background: 'var(--brand)',
              color: 'var(--brand-ink, oklch(0.18 0.02 60))',
              borderRadius: 'var(--r-btn)',
              boxShadow: 'var(--sh-tile)',
            }}
            className="inline-flex items-center gap-1.5 font-geist font-semibold text-sm px-4 py-2 disabled:opacity-50"
          >
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
