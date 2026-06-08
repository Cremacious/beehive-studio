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
import {
  updateClubAction,
  type ClubSummary,
} from '@/lib/actions/book-clubs.actions'
import { TagInput } from '@/app/[locale]/(app)/reading-lists/_components/tag-input'
import { MentionableTextarea } from '@/components/mentions/mentionable-textarea'

type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

type Props = {
  initialClub: ClubSummary
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditClubMetadataDialog({
  initialClub,
  open,
  onOpenChange,
}: Props) {
  const [name, setName] = useState(initialClub.name)
  const [description, setDescription] = useState(initialClub.description ?? '')
  const [rules, setRules] = useState(initialClub.rules ?? '')
  const [tags, setTags] = useState<string[]>(initialClub.tags ?? [])
  const [visibility, setVisibility] = useState<Visibility>(
    initialClub.visibility as Visibility,
  )
  const [discoverable, setDiscoverable] = useState(initialClub.discoverable)
  const [openJoin, setOpenJoin] = useState(initialClub.openJoin)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Re-seed form whenever the dialog opens or the source club changes.
  useEffect(() => {
    if (open) {
      setName(initialClub.name)
      setDescription(initialClub.description ?? '')
      setRules(initialClub.rules ?? '')
      setTags(initialClub.tags ?? [])
      setVisibility(initialClub.visibility as Visibility)
      setDiscoverable(initialClub.discoverable)
      setOpenJoin(initialClub.openJoin)
    }
  }, [open, initialClub])

  // Force-clear discoverable when visibility leaves PUBLIC (3-layer defense).
  useEffect(() => {
    if (visibility !== 'PUBLIC') setDiscoverable(false)
  }, [visibility])

  const submit = () => {
    if (!name.trim()) return
    startTransition(async () => {
      const result = await updateClubAction({
        clubId: initialClub.id,
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
        rules: rules.trim() ? rules.trim() : null,
        tags,
        visibility,
        discoverable,
        openJoin,
      })
      if (result.success) {
        toast.success('Club updated')
        onOpenChange(false)
        router.refresh()
      } else {
        toast.error(`Could not update club (${result.error})`)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit club</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider mb-1.5 block text-[var(--canvas-dark-ink-muted)]">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 100))}
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
              onChange={(next) => setDescription(next.slice(0, 1000))}
              maxLength={1000}
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
              Rules
            </label>
            <MentionableTextarea
              value={rules}
              onChange={(next) => setRules(next.slice(0, 2000))}
              maxLength={2000}
              rows={4}
              className="w-full px-3 py-2 rounded-[var(--r-row)] border text-sm text-[var(--canvas-dark-ink)] resize-none outline-none focus:border-[var(--canvas-dark-ink-muted)]"
              style={{
                background: 'var(--canvas-dark-100)',
                borderColor: 'var(--br-card)',
              }}
            />
            <p className="mt-1 text-xs text-[var(--canvas-dark-ink-muted)]">
              Optional — house rules, code of conduct, etc.
            </p>
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
              disabled={visibility !== 'PUBLIC'}
              onChange={(e) => setDiscoverable(e.target.checked)}
              className="rounded"
            />
            <span>Show in Discover</span>
            {visibility !== 'PUBLIC' && (
              <span className="text-xs text-[var(--canvas-dark-ink-muted)]">
                (only PUBLIC clubs can be discoverable)
              </span>
            )}
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={openJoin}
              onChange={(e) => setOpenJoin(e.target.checked)}
              className="rounded mt-0.5"
            />
            <span>
              <span className="block">Open join</span>
              <span className="text-xs text-[var(--canvas-dark-ink-muted)]">
                Anyone who can see this club can join with one click. If
                unchecked, new members must request to join and an OWNER/MOD
                approves.
              </span>
            </span>
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
            disabled={isPending || !name.trim()}
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
