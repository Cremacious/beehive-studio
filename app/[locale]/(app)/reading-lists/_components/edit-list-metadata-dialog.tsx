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
import { VisibilityPicker } from '@/app/[locale]/(public)/discover/_components/visibility-picker'
import type { SparkVisibility } from '@/db/schema/social'
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

export function EditListMetadataDialog({ initialList, open, onOpenChange }: Props) {
  const [title, setTitle] = useState(initialList.title)
  const [description, setDescription] = useState(initialList.description ?? '')
  const [tags, setTags] = useState<string[]>(initialList.tags ?? [])
  const [visibility, setVisibility] = useState<Visibility>(
    initialList.visibility as Visibility,
  )
  const [discoverable, setDiscoverable] = useState(initialList.discoverable)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isLiked = initialList.kind === 'LIKED'

  // Reset form to initial when reopened.
  useEffect(() => {
    if (open) {
      setTitle(initialList.title)
      setDescription(initialList.description ?? '')
      setTags(initialList.tags ?? [])
      setVisibility(initialList.visibility as Visibility)
      setDiscoverable(initialList.discoverable)
    }
  }, [open, initialList])

  // Force-clear discoverable when visibility leaves PUBLIC (3-layer defense).
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit list details</DialogTitle>
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
              value={visibility as SparkVisibility}
              onChange={(v) => setVisibility(v as Visibility)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={discoverable}
              disabled={visibility !== 'PUBLIC' || isLiked}
              onChange={(e) => setDiscoverable(e.target.checked)}
              className="rounded"
            />
            <span>Show in Discover</span>
            {isLiked && (
              <span className="text-xs text-[var(--canvas-dark-ink-muted)]">
                (Liked lists are never discoverable)
              </span>
            )}
            {!isLiked && visibility !== 'PUBLIC' && (
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
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
