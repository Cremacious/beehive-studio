'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pin, Pencil, Link2 } from 'lucide-react'
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
import { createBuzzPostAction } from '@/lib/actions/hive-buzz.actions'
import type { BuzzPostType } from '@/lib/validations/hive-buzz'

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
      toast.success('Pinned')
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

  const max = type === 'TEXT' ? TEXT_MAX : CAPTION_MAX

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
            Share with your hive
          </p>
          <DialogTitle
            className="font-comfortaa font-bold"
            style={{
              fontSize: '22px',
              color: 'var(--brand)',
              letterSpacing: '-0.01em',
            }}
          >
            Pin a new note
          </DialogTitle>
          <DialogDescription>
            Pick a type. Write what&apos;s on your mind.
          </DialogDescription>
        </DialogHeader>

        {/* 2-card type picker */}
        <div className="grid grid-cols-2 gap-3">
          <TypeCard
            active={type === 'TEXT'}
            onSelect={() => setType('TEXT')}
            icon={<Pencil size={16} />}
            name="Text"
            blurb="A thought, quote, or question."
          />
          <TypeCard
            active={type === 'LINK'}
            onSelect={() => setType('LINK')}
            icon={<Link2 size={16} />}
            name="Link"
            blurb="Share an article, video, or post."
          />
        </div>

        {/* Body / caption — standard dark gray input */}
        {type === 'TEXT' ? (
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
                autoFocus
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
            <Pin size={14} />
            {submitting ? 'Pinning…' : 'Pin it'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TypeCard({
  active,
  onSelect,
  icon,
  name,
  blurb,
}: {
  active: boolean
  onSelect: () => void
  icon: React.ReactNode
  name: string
  blurb: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="text-left p-3.5 cursor-pointer transition-shadow"
      style={{
        background:
          'linear-gradient(180deg, var(--canvas-dark-350), var(--canvas-dark-300))',
        boxShadow: active
          ? 'var(--sh-tile), 0 0 0 2px oklch(from var(--brand) l c h / 0.45)'
          : 'var(--sh-tile)',
        border: active
          ? '1px solid var(--brand)'
          : '1px solid transparent',
        borderRadius: 'var(--r-row)',
      }}
    >
      <span
        className="inline-flex items-center justify-center mb-2"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'oklch(from var(--brand) l c h / 0.16)',
          color: 'var(--brand)',
        }}
      >
        {icon}
      </span>
      <div
        className="font-comfortaa font-bold text-[14px]"
        style={{ color: 'var(--canvas-dark-ink-strong)' }}
      >
        {name}
      </div>
      <div
        className="text-[11.5px] mt-0.5"
        style={{ color: 'var(--canvas-dark-ink-muted)' }}
      >
        {blurb}
      </div>
    </button>
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
