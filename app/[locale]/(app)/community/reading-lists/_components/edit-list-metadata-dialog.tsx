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
import { updateListAction } from '@/lib/actions/reading-lists.actions'
import type { ListSummary } from '@/lib/actions/reading-lists.actions'
import { TagInput } from './tag-input'
import { MentionableTextarea } from '@/components/mentions/mentionable-textarea'

type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

type Props = {
  initialList: ListSummary
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

export function EditListMetadataDialog({ initialList, open, onOpenChange }: Props) {
  const [title, setTitle] = useState(initialList.title)
  const [description, setDescription] = useState(initialList.description ?? '')
  const [tags, setTags] = useState<string[]>(initialList.tags ?? [])
  const [visibility, setVisibility] = useState<Visibility>(initialList.visibility as Visibility)
  const [discoverable, setDiscoverable] = useState(initialList.discoverable)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isLiked = initialList.kind === 'LIKED'

  useEffect(() => {
    if (open) {
      setTitle(initialList.title)
      setDescription(initialList.description ?? '')
      setTags(initialList.tags ?? [])
      setVisibility(initialList.visibility as Visibility)
      setDiscoverable(initialList.discoverable)
    }
  }, [open, initialList])

  useEffect(() => {
    if (visibility !== 'PUBLIC') setDiscoverable(false)
  }, [visibility])

  const submit = () => {
    if (!title.trim()) return
    startTransition(async () => {
      const result = await updateListAction({
        listId: initialList.id,
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        visibility,
        discoverable,
        tags,
      })
      if (result.success) {
        toast.success('List updated')
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(`Could not update list (${result.error})`)
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
            Edit list details
          </DialogTitle>
          <p className="text-[13px] mt-1" style={{ color: 'var(--canvas-dark-ink-muted)' }}>
            Changes are visible to anyone who can see this list.
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <SectionDivider label="Content" />

          <div className="flex flex-col gap-2">
            <label htmlFor="el-title" className={labelClass} style={labelStyle}>
              Title <span style={{ color: 'var(--brand)' }}>*</span>
            </label>
            <input
              id="el-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              maxLength={100}
              autoFocus
              className="w-full h-10 px-3.5 rounded-[var(--r-row)] text-[14px] outline-none focus:ring-2 focus:ring-[oklch(from_var(--brand)_l_c_h_/_0.35)]"
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="el-desc" className={labelClass} style={labelStyle}>
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
              disabled={visibility !== 'PUBLIC' || isLiked}
              onChange={(e) => setDiscoverable(e.target.checked)}
              className="h-4 w-4 accent-[var(--brand)] disabled:opacity-40"
            />
            <span style={{ color: 'var(--canvas-dark-ink)' }}>Show in Discover</span>
            {isLiked && (
              <span className="text-[11px] ml-auto" style={{ color: 'var(--canvas-dark-ink-faint)' }}>
                liked lists only
              </span>
            )}
            {!isLiked && visibility !== 'PUBLIC' && (
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
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
