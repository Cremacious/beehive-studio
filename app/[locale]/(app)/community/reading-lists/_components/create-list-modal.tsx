'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { VisibilityPicker, PUBLIC_FRIENDS_PRIVATE_OPTIONS } from '@/components/visibility-picker'
import { createListAction } from '@/lib/actions/reading-lists.actions'
import { MentionableTextarea } from '@/components/mentions/mentionable-textarea'
import { TagInput } from './tag-input'

type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

type Props = {
  locale: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const inputStyle = {
  background: '#1E1E1E',
  boxShadow: 'var(--sh-inset)',
  color: 'var(--canvas-dark-ink)',
} as const

const labelClass = 'text-[10px] font-mono uppercase tracking-[0.14em]'
const labelStyle = { color: 'var(--canvas-dark-ink-muted)' } as const

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        style={{
          width: 4, height: 4, borderRadius: '50%',
          background: 'var(--brand)', display: 'inline-block', flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--brand)',
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

export function CreateListModal({ locale, open, onOpenChange }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC')
  const [discoverable, setDiscoverable] = useState(true)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (!open) {
      setTitle('')
      setDescription('')
      setTags([])
      setVisibility('PUBLIC')
      setDiscoverable(true)
    }
  }, [open])

  useEffect(() => {
    if (visibility !== 'PUBLIC') setDiscoverable(false)
  }, [visibility])

  const submit = () => {
    if (!title.trim()) return
    startTransition(async () => {
      const result = await createListAction({
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        discoverable,
        tags,
      })
      if (result.success) {
        toast.success('Reading list created')
        onOpenChange(false)
        router.push(`/${locale}/community/reading-lists/${result.data.id}`)
      } else {
        toast.error(`Could not create list (${result.error})`)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-7 gap-6 dialog-ios">
        <DialogHeader>
          <DialogTitle
            className="font-display"
            style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--canvas-dark-ink-strong)' }}
          >
            New reading list
          </DialogTitle>
          <p className="text-[13px] mt-1" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Curate books worth sharing. You can change these later.
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <SectionDivider label="Content" />

          <div className="flex flex-col gap-2">
            <label htmlFor="cl-title" className={labelClass} style={labelStyle}>
              Title <span style={{ color: 'var(--brand)' }}>*</span>
            </label>
            <input
              id="cl-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              maxLength={100}
              autoFocus
              placeholder="e.g. Cozy fantasy reads"
              className="w-full h-10 px-3.5 rounded-[var(--r-row)] text-[14px] outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="cl-desc" className={labelClass} style={labelStyle}>
              Description
            </label>
            <MentionableTextarea
              value={description}
              onChange={(next) => setDescription(next.slice(0, 500))}
              maxLength={500}
              rows={3}
              placeholder="What ties this list together?"
              className="w-full px-3.5 py-2.5 rounded-[var(--r-row)] text-[14px] resize-none outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>
              Tags
              <span className="ml-2 normal-case tracking-normal" style={{ color: 'var(--canvas-dark-ink-faint)' }}>
                up to 5
              </span>
            </label>
            <TagInput value={tags} onChange={setTags} max={5} maxChars={20} />
          </div>

          <SectionDivider label="Sharing" />

          <div className="flex flex-col gap-2">
            <label className={labelClass} style={labelStyle}>
              Visibility
            </label>
            <VisibilityPicker
              value={visibility}
              onChange={setVisibility}
              options={PUBLIC_FRIENDS_PRIVATE_OPTIONS}
            />
          </div>

          <label
            className="flex items-center gap-2.5 text-[13px] py-2.5 px-3 rounded-[var(--r-row)] cursor-pointer select-none"
            style={{ background: 'oklch(1 0 0 / 0.025)', border: 'var(--br-card)' }}
          >
            <input
              type="checkbox"
              checked={discoverable}
              disabled={visibility !== 'PUBLIC'}
              onChange={(e) => setDiscoverable(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)] disabled:opacity-40"
            />
            <span style={{ color: 'var(--canvas-dark-ink)' }}>Show in Discover</span>
            {visibility !== 'PUBLIC' && (
              <span className="text-[11px] ml-auto" style={{ color: 'var(--canvas-dark-ink-faint)' }}>
                public lists only
              </span>
            )}
          </label>
        </div>

        <DialogFooter className="dialog-ios-footer">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-[var(--r-pill)] text-[13px] font-medium transition-colors"
            style={{ color: 'var(--canvas-dark-ink-muted)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !title.trim()}
            className="h-9 px-5 rounded-[var(--r-pill)] text-[13px] font-semibold disabled:opacity-40"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            {isPending ? 'Creating…' : 'Create list'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
