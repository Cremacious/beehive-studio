'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MentionableTextarea } from '@/components/mentions/mentionable-textarea'
import { updateBuzzPostAction } from '@/lib/actions/hive-buzz.actions'
import type { BuzzPostSummary } from '@/lib/actions/hive-buzz.actions'

const TEXT_MAX = 1000
const CAPTION_MAX = 280

const textareaStyle: React.CSSProperties = {
  background: 'var(--canvas-dark-100)',
  boxShadow: 'var(--sh-inset)',
  border: 0,
  borderRadius: 'var(--r-row)',
  padding: '14px 16px',
  fontFamily: 'var(--font-ui)',
  fontSize: '14.5px',
  lineHeight: 1.55,
  color: 'var(--canvas-dark-ink-strong)',
  minHeight: '120px',
}

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

  const max = post.type === 'TEXT' ? TEXT_MAX : CAPTION_MAX

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <p
            className="font-mono uppercase tracking-wider"
            style={{
              fontSize: '10px',
              letterSpacing: '0.16em',
              color: 'var(--canvas-dark-ink-muted)',
              marginBottom: '4px',
            }}
          >
            {post.type === 'TEXT' ? 'Text note' : 'Link share'} · editing
          </p>
          <DialogTitle
            className="font-comfortaa font-bold"
            style={{
              fontSize: '22px',
              color: 'var(--brand)',
              letterSpacing: '-0.01em',
            }}
          >
            Edit note
          </DialogTitle>
          <DialogDescription>
            The type can&apos;t be changed. Delete and recreate to switch between text and link.
          </DialogDescription>
        </DialogHeader>

        {post.type === 'TEXT' ? (
          <div>
            <MentionableTextarea
              value={body}
              onChange={setBody}
              placeholder="What's the buzz?"
              rows={6}
              maxLength={TEXT_MAX}
              autoFocus
              className="w-full outline-none resize-y disabled:opacity-60"
              style={textareaStyle}
            />
            <Counter current={body.length} max={max} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label
                className="block mb-[7px] font-mono uppercase"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  color: 'var(--canvas-dark-ink-muted)',
                }}
              >
                URL <span style={{ color: 'var(--status-error)' }}>*</span>
              </label>
              <input
                type="url"
                inputMode="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                aria-invalid={linkUrl.length > 0 && !linkValid}
                className="w-full outline-none disabled:opacity-60"
                style={{
                  background: 'var(--canvas-dark-100)',
                  boxShadow:
                    linkUrl.length > 0 && !linkValid
                      ? 'inset 0 0 0 1px oklch(from var(--status-error) l c h / 0.5), var(--sh-inset)'
                      : 'var(--sh-inset)',
                  border: 0,
                  borderRadius: 'var(--r-row)',
                  padding: '11px 14px',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '14px',
                  color: 'var(--canvas-dark-ink-strong)',
                }}
              />
              {linkUrl.length > 0 && !linkValid && (
                <p
                  className="mt-1.5 text-[12px]"
                  style={{ color: 'var(--status-error)' }}
                >
                  Must be a valid https URL.
                </p>
              )}
            </div>
            <div>
              <label
                className="block mb-[7px] font-mono uppercase"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  color: 'var(--canvas-dark-ink-muted)',
                }}
              >
                Caption (optional)
              </label>
              <MentionableTextarea
                value={body}
                onChange={setBody}
                placeholder="Why are you sharing this?"
                rows={3}
                maxLength={CAPTION_MAX}
                className="w-full outline-none resize-y disabled:opacity-60"
                style={textareaStyle}
              />
              <Counter current={body.length} max={max} />
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
              color: 'var(--brand-ink)',
              borderRadius: 'var(--r-pill)',
              boxShadow: 'var(--sh-tile)',
            }}
            className="inline-flex items-center gap-1.5 font-comfortaa font-semibold text-[13px] px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Counter({ current, max }: { current: number; max: number }) {
  return (
    <div
      className="flex justify-end mt-1.5 font-mono"
      style={{
        fontSize: '11px',
        color:
          current > max * 0.9
            ? 'var(--brand)'
            : 'var(--canvas-dark-ink-faint)',
      }}
    >
      {current} / {max}
    </div>
  )
}
