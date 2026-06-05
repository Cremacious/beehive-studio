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
import { createClubAction } from '@/lib/actions/book-clubs.actions'
import { TagInput } from '@/app/[locale]/(app)/reading-lists/_components/tag-input'

type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

type Props = {
  locale: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateClubModal({ locale, open, onOpenChange }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC')
  const [discoverable, setDiscoverable] = useState(true)
  const [openJoin, setOpenJoin] = useState(true)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Reset form when closed.
  useEffect(() => {
    if (!open) {
      setName('')
      setDescription('')
      setRules('')
      setTags([])
      setVisibility('PUBLIC')
      setDiscoverable(true)
      setOpenJoin(true)
    }
  }, [open])

  // Force-clear discoverable when visibility leaves PUBLIC (3-layer defense).
  useEffect(() => {
    if (visibility !== 'PUBLIC') setDiscoverable(false)
  }, [visibility])

  const submit = () => {
    if (!name.trim()) return
    startTransition(async () => {
      const result = await createClubAction({
        name: name.trim(),
        description: description.trim() || undefined,
        rules: rules.trim() || undefined,
        tags,
        visibility,
        discoverable,
        openJoin,
      })
      if (result.success) {
        toast.success('Book club created')
        onOpenChange(false)
        router.push(`/${locale}/clubs/${result.data.id}`)
      } else {
        toast.error(`Could not create club (${result.error})`)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New book club</DialogTitle>
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
              placeholder="e.g. The Cozy Fantasy Society"
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
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              maxLength={1000}
              rows={3}
              placeholder="What's this club about?"
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
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value.slice(0, 2000))}
              maxLength={2000}
              rows={4}
              placeholder="House rules, code of conduct, etc."
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
            {isPending ? 'Creating…' : 'Create club'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
