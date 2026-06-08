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

export function CreateListModal({ locale, open, onOpenChange }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC')
  const [discoverable, setDiscoverable] = useState(true)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Reset form when closed.
  useEffect(() => {
    if (!open) {
      setTitle('')
      setDescription('')
      setTags([])
      setVisibility('PUBLIC')
      setDiscoverable(true)
    }
  }, [open])

  // Force-clear discoverable when visibility leaves PUBLIC (3-layer defense).
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
        router.push(`/${locale}/reading-lists/${result.data.id}`)
      } else {
        toast.error(`Could not create list (${result.error})`)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New reading list</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider mb-1.5 block text-[var(--canvas-dark-ink-muted)]">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              maxLength={100}
              autoFocus
              placeholder="e.g. Cozy fantasy reads"
              className="w-full px-3 py-2 rounded-[var(--r-row)] border text-sm text-[var(--canvas-dark-ink)] outline-none focus:border-[var(--canvas-dark-ink-muted)]"
              style={{
                background: 'var(--canvas-dark-100)',
                borderColor: 'var(--br-card)',
              }}
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider mb-1.5 block text-[var(--canvas-dark-ink-muted)]">
              Description
            </label>
            <MentionableTextarea
              value={description}
              onChange={(next) => setDescription(next.slice(0, 500))}
              maxLength={500}
              rows={3}
              placeholder="What ties this list together?"
              className="w-full px-3 py-2 rounded-[var(--r-row)] border text-sm text-[var(--canvas-dark-ink)] resize-none outline-none focus:border-[var(--canvas-dark-ink-muted)]"
              style={{
                background: 'var(--canvas-dark-100)',
                borderColor: 'var(--br-card)',
              }}
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider mb-1.5 block text-[var(--canvas-dark-ink-muted)]">
              Tags (up to 5)
            </label>
            <TagInput value={tags} onChange={setTags} max={5} maxChars={20} />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider mb-2 block text-[var(--canvas-dark-ink-muted)]">
              Visibility
            </label>
            <VisibilityPicker
              value={visibility}
              onChange={setVisibility}
              options={PUBLIC_FRIENDS_PRIVATE_OPTIONS}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={discoverable}
              disabled={visibility !== 'PUBLIC'}
              onChange={(e) => setDiscoverable(e.target.checked)}
              className="rounded"
            />
            <span>Show in Discover</span>
            {visibility !== 'PUBLIC' && (
              <span className="text-xs text-[var(--canvas-dark-ink-muted)]">
                (only PUBLIC lists can be discoverable)
              </span>
            )}
          </label>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm text-[var(--canvas-dark-ink-muted)] hover:text-[var(--canvas-dark-ink)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !title.trim()}
            className="px-5 py-2 rounded-[var(--r-pill)] text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            {isPending ? 'Creating…' : 'Create list'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
